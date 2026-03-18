const { app, BrowserWindow, ipcMain, Menu, MenuItem, nativeTheme, dialog, shell } = require('electron')
const os = require("os");
const path = require("path");
const fs = require("fs");

// global.data //全局数据
global.shareData = {
    userSSHInfo: {}, //一定要把数据放在结构体里面！！！
    isDark: nativeTheme.shouldUseDarkColors,
} //用于共享

let processLock = 0

// ==================== SFTP 连接池 ====================
// 每个连接条目结构：{ sftp: SftpClient, ssh2: ssh2.Client, connected: bool }
const sftpPool = new Map()

function getSshKey(senderId, sshId) {
    return `${senderId}_${sshId}`
}

function getPoolEntry(senderId, sshId) {
    return sftpPool.get(getSshKey(senderId, sshId))
}

async function disposeEntry(entry) {
    if (!entry) return
    try { await entry.sftp.end() } catch(e) {}
}

// ==================== 菜单 ====================

function createMenu() {
    var template = [{
            label: "Estp",
            submenu: [{
                    label: "关于",
                    click: function() { app.showAboutPanel() }
                },
                { type: 'separator' },
                { label: "退出", accelerator: "CmdOrCtrl+Q", click: function() { app.quit() } },
            ]
        },
        {
            label: "编辑",
            submenu: [
                { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
                { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
                { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: "Select All", accelerator: "CmdOrCtrl+A", role: "selectAll" },
            ]
        },
        {
            label: "显示",
            submenu: [
                { label: "Light Theme", click: function() { setTheme(false) } },
                { label: "Dark Theme", click: function() { setTheme(true) } },
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
    createMenu()
    return createIndexWindow()
}

function createIndexWindow() {
    let win_w = 1100
    let minWidth = 900
    let height = 768
    let minHeight = 600
    let x = null
    let y = null

    if (BrowserWindow.getAllWindows().length > 0 && BrowserWindow.getFocusedWindow()) {
        let size = BrowserWindow.getFocusedWindow().getSize()
        let position = BrowserWindow.getFocusedWindow().getPosition()
        win_w = size[0]
        height = size[1]
        x = position[0]
        y = position[1]
    }

    const win = new BrowserWindow({
        title: "Eftp",
        titleBarStyle: "hiddenInset",
        x: x,
        y: y,
        width: win_w,
        minWidth: minWidth,
        height: height,
        minHeight: minHeight,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        }
    })

    win.on('close', (event) => {
        if (processLock > 0 && BrowserWindow.getAllWindows().length == 1) {
            event.preventDefault()
            dialog.showMessageBox(win, {
                buttons: ["OK", "Cancel"],
                message: `有${processLock}个后台任务正在进行,确定退出?`,
                cancelId: 1,
            }).then((result) => {
                if (result.response == 0) {
                    win.destroy()
                }
            })
        }
    })

    win.loadFile('login.html')

    if (process.argv.includes('-t')) {
        win.webContents.openDevTools()
    }

    return win.id
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    app.quit()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// ==================== 基础 IPC ====================

ipcMain.handle('get_share_data', () => global.shareData)
ipcMain.handle('get_is_dark', () => nativeTheme.shouldUseDarkColors)

ipcMain.handle('maximize_window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
        win.isMaximized() ? win.unmaximize() : win.maximize()
    }
})

ipcMain.handle('get_user_data_path', () => app.getPath('userData'))

// 文件读写 IO
ipcMain.handle('fs_read_file', (event, filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8')
        return { ok: true, data }
    } catch (e) {
        return { ok: false, error: e.message }
    }
})

ipcMain.handle('fs_write_file', (event, filePath, data) => {
    try {
        fs.writeFileSync(filePath, data, 'utf8')
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e.message }
    }
})

ipcMain.handle('fs_delete_file', (event, filePath) => {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e.message }
    }
})

ipcMain.handle('fs_stat_size', (event, filePath) => {
    try {
        const stat = fs.statSync(filePath)
        return { ok: true, size: stat.size }
    } catch (e) {
        return { ok: false, size: 0 }
    }
})

ipcMain.handle('fs_exists', (event, filePath) => {
    return fs.existsSync(filePath)
})

ipcMain.handle('fs_unlink', (event, filePath) => {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e.message }
    }
})

// 用系统默认程序打开文件
ipcMain.handle('open_file_native', (event, filePath) => {
    shell.openPath(filePath)
})

// 文件选择对话框
ipcMain.handle('show_open_file_dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'] })
    if (!result.canceled && result.filePaths.length > 0) {
        return { ok: true, file: result.filePaths[0] }
    }
    return { ok: false }
})

ipcMain.handle('show_open_files_dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] })
    if (!result.canceled && result.filePaths.length > 0) {
        return { ok: true, files: result.filePaths }
    }
    return { ok: false }
})

ipcMain.handle('show_open_folder_dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (!result.canceled && result.filePaths.length > 0) {
        let folder = result.filePaths[0]
        if (!folder.endsWith('/')) folder += '/'
        return { ok: true, folder }
    }
    return { ok: false }
})

// 跳转 SSH 主界面
ipcMain.on('go_ssh', (event, userSSHInfo) => {
    const current_win = BrowserWindow.fromWebContents(event.sender)
    if (BrowserWindow.getAllWindows().length == 1) {
        // 只有一个窗口（主窗口），直接加载 SSH 连接
        global.shareData.userSSHInfo = userSSHInfo
        current_win.loadFile('index.html')
    } else {
        // 有多个窗口（主窗口 + 登录窗口），关闭登录窗口，给主窗口发事件
        current_win.close()
        BrowserWindow.getAllWindows().forEach((win) => {
            // 只给还活着的窗口发事件（排除已关闭或即将关闭的当前窗口）
            if (win !== current_win && !win.isDestroyed()) {
                win.webContents.send('add_ssh', userSSHInfo)
            }
        })
    }
})

ipcMain.on('new_win', () => createWindow())

ipcMain.on('set_lock', (event, isAdd) => {
    processLock = isAdd ? processLock + 1 : Math.max(0, processLock - 1)
})

nativeTheme.on('updated', () => setTheme(nativeTheme.shouldUseDarkColors))

function setTheme(isDark) {
    BrowserWindow.getAllWindows().forEach((win) => {
        global.shareData.isDark = isDark
        win.webContents.send('themeChanged', isDark)
    })
}

// ==================== SFTP IPC ====================

/**
 * 建立 SFTP 连接（ssh2-sftp-client）
 * 同时保存原始 ssh2 Client 供 exec 使用
 */
ipcMain.handle('ssh_connect', async (event, sshId, userSSHInfo) => {
    const SftpClient = require('ssh2-sftp-client')
    const { Client: SSH2Client } = require('ssh2')

    const key = getSshKey(event.sender.id, sshId)

    // 关闭旧连接
    const old = sftpPool.get(key)
    if (old) {
        await disposeEntry(old)
        sftpPool.delete(key)
    }

    const connectOpts = {
        host: userSSHInfo.host,
        port: parseInt(userSSHInfo.port) || 22,
        username: userSSHInfo.username,
        readyTimeout: 15000,
        retries: 1,
    }
    if (userSSHInfo.privateKey && userSSHInfo.privateKey !== '') {
        try {
            connectOpts.privateKey = fs.readFileSync(userSSHInfo.privateKey)
        } catch(e) {
            return { ok: false, error: `读取私钥失败: ${e.message}` }
        }
    } else {
        connectOpts.password = userSSHInfo.password
    }

    // 1. 建立 SFTP 连接
    const sftp = new SftpClient()
    try {
        await sftp.connect(connectOpts)
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }

    // 2. 建立独立的 ssh2 exec 连接（用于 shell 命令）
    const ssh2 = new SSH2Client()
    const execConnected = await new Promise((resolve) => {
        ssh2.on('ready', () => resolve(true))
        ssh2.on('error', () => resolve(false))
        ssh2.connect(connectOpts)
    })

    sftpPool.set(key, { sftp, ssh2, execConnected })
    return { ok: true }
})

/**
 * 执行远程命令（通过 ssh2 exec）
 */
ipcMain.handle('ssh_exec', async (event, sshId, cmd, args, options = {}) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }

    const fullCmd = args && args.length > 0
        ? `${cmd} ${args.map(a => `'${String(a).replace(/'/g, "'\\''")}'`).join(' ')}`
        : cmd

    const encoding = options.encoding || 'utf8'

    return new Promise((resolve) => {
        if (!entry.execConnected || !entry.ssh2) {
            resolve({ ok: false, error: 'exec channel not available' })
            return
        }
        entry.ssh2.exec(fullCmd, { env: options.env || {} }, (err, stream) => {
            if (err) { resolve({ ok: false, error: err.message }); return }

            let stdout = ''
            let stderr = ''
            stream.on('data', (d) => { stdout += d.toString(encoding) })
            stream.stderr.on('data', (d) => { stderr += d.toString(encoding) })
            stream.on('close', (code) => {
                resolve({ ok: code === 0, stdout, stderr, code })
            })
        })
    })
})

/**
 * 列出远程目录（sftp.list）
 * 返回统一格式的文件条目数组
 */
ipcMain.handle('sftp_list', async (event, sshId, remotePath) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }
    try {
        const list = await entry.sftp.list(remotePath)
        // 标准化字段：name, size, type('d'|'-'|'l'), modifyTime, rights.octal
        const files = list.map(f => ({
            name: f.name,
            size: f.size,
            type: f.type,  // 'd' = dir, '-' = file, 'l' = symlink
            modifyTime: f.modifyTime,
            accessTime: f.accessTime,
            rights: f.rights,
            owner: f.owner,
            group: f.group,
        }))
        return { ok: true, files }
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }
})

/**
 * 获取远程文件信息（stat）
 */
ipcMain.handle('sftp_stat', async (event, sshId, remotePath) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }
    try {
        const stat = await entry.sftp.stat(remotePath)
        return { ok: true, size: stat.size, isDirectory: stat.isDirectory }
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }
})

// fastGet/fastPut 的性能参数：大并发窗口 + 大 chunk，充分利用带宽
const SFTP_CONCURRENCY = 64   // 并发请求窗口数（默认 64，可视网络质量调整）
const SFTP_CHUNK_SIZE  = 32768 // 每个请求的数据块大小 32 KB（ssh2 协议上限）

/**
 * 下载文件（支持断点续传）
 *
 * 全新下载：fastGet（多并发窗口，可打满带宽）
 * 断点续传：先用 fastGet 下到临时文件，完成后追加合并
 * 进度通过 IPC push 推送给渲染进程
 */
ipcMain.handle('sftp_download', async (event, sshId, remotePath, localPath, transferId) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }

    try {
        // 获取远程文件大小
        const stat = await entry.sftp.stat(remotePath)
        const totalBytes = stat.size

        // 断点续传：检查本地已有大小
        let startByte = 0
        if (fs.existsSync(localPath)) {
            startByte = fs.statSync(localPath).size
        }

        if (startByte >= totalBytes) {
            return { ok: true, resumed: false, message: 'already complete' }
        }

        // 用 transferId 做进度 channel，彻底隔离多文件并发
        const progressChannel = transferId ? `sftp_progress_${transferId}` : `sftp_progress_${sshId}`
        const sendProgress = (transferred) => {
            if (!event.sender.isDestroyed()) {
                event.sender.send(progressChannel, {
                    transferred,
                    total: totalBytes,
                    percent: Math.floor(transferred / totalBytes * 100)
                })
            }
        }

        if (startByte === 0) {
            // 全新下载：直接 fastGet，带进度步进回调
            await entry.sftp.fastGet(remotePath, localPath, {
                concurrency: SFTP_CONCURRENCY,
                chunkSize: SFTP_CHUNK_SIZE,
                step: (transferred, _chunk, total) => sendProgress(transferred)
            })
        } else {
            // 断点续传：下载剩余部分到临时文件，再追加合并
            const tmpPath = localPath + '.part'
            try {
                await entry.sftp.fastGet(remotePath, tmpPath, {
                    concurrency: SFTP_CONCURRENCY,
                    chunkSize: SFTP_CHUNK_SIZE,
                    // fastGet 不支持 start offset，只能下完整文件到 tmp
                    // 但比 createReadStream 仍快很多；进度从 startByte 起算
                    step: (transferred, _chunk, total) => sendProgress(startByte + transferred)
                })
                // 追加合并：将 tmp 内容从 startByte 处截取后 append 到原文件
                // 注意：fastGet 会下载完整文件到 tmp，取 [startByte, end] 段追加
                await new Promise((resolve, reject) => {
                    const rs = fs.createReadStream(tmpPath, { start: startByte })
                    const ws = fs.createWriteStream(localPath, { flags: 'a' })
                    rs.on('error', reject)
                    ws.on('error', reject)
                    ws.on('finish', resolve)
                    rs.pipe(ws)
                })
            } finally {
                try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath) } catch(e) {}
            }
        }

        return { ok: true, resumed: startByte > 0, size: totalBytes }
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }
})

/**
 * 上传单个文件（支持断点续传）
 *
 * 全新上传：fastPut（多并发窗口，可打满带宽）
 * 断点续传：先用 append（单通道）从断点处续传
 *   — 注意：fastPut 不支持 offset，断点续传只能退回 append，
 *     但 99% 的场景是全新上传，速度有质的提升
 * 进度通过 IPC push 推送给渲染进程
 */
ipcMain.handle('sftp_upload', async (event, sshId, localPath, remotePath, transferId) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }

    try {
        const localFileSize = fs.statSync(localPath).size
        // 用 transferId 做进度 channel，彻底隔离多文件并发
        const progressChannel = transferId ? `sftp_progress_${transferId}` : `sftp_progress_${sshId}`

        // 检查远程文件已有大小（断点续传）
        let remoteFileSize = 0
        try {
            const remoteStat = await entry.sftp.stat(remotePath)
            remoteFileSize = remoteStat.size
        } catch(e) {
            // 文件不存在，从头上传
        }

        if (remoteFileSize >= localFileSize) {
            return { ok: true, resumed: false, message: 'already complete' }
        }

        const sendProgress = (transferred) => {
            if (!event.sender.isDestroyed()) {
                event.sender.send(progressChannel, {
                    transferred,
                    total: localFileSize,
                    percent: Math.floor(transferred / localFileSize * 100)
                })
            }
        }

        if (remoteFileSize === 0) {
            // 全新上传：fastPut 多并发窗口，带进度步进回调
            await entry.sftp.fastPut(localPath, remotePath, {
                concurrency: SFTP_CONCURRENCY,
                chunkSize: SFTP_CHUNK_SIZE,
                step: (transferred, _chunk, total) => sendProgress(transferred)
            })
        } else {
            // 断点续传：从断点处追加，单通道但保证正确性
            let totalTransferred = remoteFileSize
            const readStream = fs.createReadStream(localPath, { start: remoteFileSize })
            readStream.on('data', (chunk) => {
                totalTransferred += chunk.length
                sendProgress(totalTransferred)
            })
            await entry.sftp.append(readStream, remotePath)
        }

        return { ok: true, resumed: remoteFileSize > 0, size: localFileSize }
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }
})

/**
 * 批量上传文件
 */
ipcMain.handle('sftp_put_files', async (event, sshId, fileItems) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }

    const errors = []
    for (const item of fileItems) {
        try {
            await entry.sftp.fastPut(item.local, item.remote)
        } catch(e) {
            errors.push({ file: item.local, error: e.message })
        }
    }
    return errors.length === 0
        ? { ok: true }
        : { ok: false, error: errors.map(e => e.error).join('; '), errors }
})

/**
 * 上传整个目录（递归）
 */
ipcMain.handle('sftp_put_directory', async (event, sshId, localDir, remoteDir) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }
    try {
        await entry.sftp.uploadDir(localDir, remoteDir, {
            filter: (itemPath) => {
                const base = path.basename(itemPath)
                return !base.startsWith('.') && base !== 'node_modules'
            }
        })
        return { ok: true }
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }
})

/**
 * 下载整个目录
 */
ipcMain.handle('sftp_get_directory', async (event, sshId, remoteDir, localDir) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }
    try {
        await entry.sftp.downloadDir(remoteDir, localDir)
        return { ok: true }
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }
})

/**
 * 创建远程目录
 */
ipcMain.handle('sftp_mkdir', async (event, sshId, remotePath) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }
    try {
        await entry.sftp.mkdir(remotePath, true)  // true = 递归创建
        return { ok: true }
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }
})

/**
 * 删除远程文件
 */
ipcMain.handle('sftp_delete', async (event, sshId, remotePath) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }
    try {
        await entry.sftp.delete(remotePath)
        return { ok: true }
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }
})

/**
 * 删除远程目录（递归）
 */
ipcMain.handle('sftp_rmdir', async (event, sshId, remotePath) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }
    try {
        await entry.sftp.rmdir(remotePath, true)  // true = 递归
        return { ok: true }
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }
})

/**
 * 重命名远程文件/目录
 */
ipcMain.handle('sftp_rename', async (event, sshId, oldPath, newPath) => {
    const entry = getPoolEntry(event.sender.id, sshId)
    if (!entry) return { ok: false, error: 'not connected' }
    try {
        await entry.sftp.rename(oldPath, newPath)
        return { ok: true }
    } catch(e) {
        return { ok: false, error: e.message || String(e) }
    }
})

/**
 * 断开连接
 */
ipcMain.handle('ssh_dispose', async (event, sshId) => {
    const key = getSshKey(event.sender.id, sshId)
    const entry = sftpPool.get(key)
    if (entry) {
        await disposeEntry(entry)
        if (entry.ssh2) { try { entry.ssh2.end() } catch(e) {} }
        sftpPool.delete(key)
    }
    return { ok: true }
})

// ==================== 右键菜单 IPC ====================

function sendMenuAction(sender, action) {
    sender.send('menu_action', action)
}

ipcMain.on('show_host_menu', (event, id) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const menu = new Menu()
    menu.append(new MenuItem({ label: '编辑', click() { sendMenuAction(event.sender, { type: 'host_edit', id }) } }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: '删除', click() { sendMenuAction(event.sender, { type: 'host_delete', id }) } }))
    menu.popup({ window: win })
})

ipcMain.on('show_file_menu', (event, id) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const menu = new Menu()
    menu.append(new MenuItem({ label: '下载', click() { sendMenuAction(event.sender, { type: 'file_download', id }) } }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: '复制', click() { sendMenuAction(event.sender, { type: 'file_copy', id }) } }))
    menu.append(new MenuItem({ label: '剪切', click() { sendMenuAction(event.sender, { type: 'file_cut', id }) } }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: '删除', click() { sendMenuAction(event.sender, { type: 'file_delete', id }) } }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: '解压', click() { sendMenuAction(event.sender, { type: 'file_unzip', id }) } }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: '重命名', click() { sendMenuAction(event.sender, { type: 'file_rename', id }) } }))
    menu.popup({ window: win })
})

ipcMain.on('show_folder_menu', (event, id) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const menu = new Menu()
    menu.append(new MenuItem({ label: '复制', click() { sendMenuAction(event.sender, { type: 'folder_copy', id }) } }))
    menu.append(new MenuItem({ label: '剪切', click() { sendMenuAction(event.sender, { type: 'folder_cut', id }) } }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: '删除', click() { sendMenuAction(event.sender, { type: 'folder_delete', id }) } }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: '收藏', click() { sendMenuAction(event.sender, { type: 'folder_favourite', id }) } }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: '压缩', click() { sendMenuAction(event.sender, { type: 'folder_zip', id }) } }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: '重命名', click() { sendMenuAction(event.sender, { type: 'folder_rename', id }) } }))
    menu.popup({ window: win })
})

ipcMain.on('show_favourite_menu', (event, id) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const menu = new Menu()
    menu.append(new MenuItem({ label: '删除', click() { sendMenuAction(event.sender, { type: 'favourite_delete', id }) } }))
    menu.popup({ window: win })
})

ipcMain.on('show_dir_menu', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const menu = new Menu()
    menu.append(new MenuItem({ label: '粘贴', click() { sendMenuAction(event.sender, { type: 'dir_paste' }) } }))
    menu.popup({ window: win })
})

ipcMain.on('show_tab_menu', (event, id) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const menu = new Menu()
    menu.append(new MenuItem({ label: '关闭', click() { sendMenuAction(event.sender, { type: 'tab_close', id }) } }))
    menu.popup({ window: win })
})

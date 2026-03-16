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

// SSH 连接池（按渲染进程 webContents id + sshId 索引）
const sshPool = new Map()

function getSshKey(senderId, sshId) {
    return `${senderId}_${sshId}`
}

function createMenu() {
    var template = [{
            label: "Estp",
            submenu: [{
                    label: "关于",
                    click: function() {
                        app.showAboutPanel()
                    }
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

// ==================== IPC Handlers ====================

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
        global.shareData.userSSHInfo = userSSHInfo
        current_win.loadFile('index.html')
    } else {
        current_win.close()
        BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('add_ssh', userSSHInfo)
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

// ==================== SSH IPC ====================

ipcMain.handle('ssh_connect', async (event, sshId, userSSHInfo) => {
    const { NodeSSH } = require('node-ssh')
    const key = getSshKey(event.sender.id, sshId)
    // 关闭旧连接
    if (sshPool.has(key)) {
        try { sshPool.get(key).dispose() } catch(e) {}
        sshPool.delete(key)
    }

    const ssh = new NodeSSH()
    const connectOpts = {
        host: userSSHInfo.host,
        username: userSSHInfo.username,
        port: userSSHInfo.port,
    }
    if (userSSHInfo.privateKey && userSSHInfo.privateKey !== '') {
        connectOpts.privateKeyPath = userSSHInfo.privateKey
    } else {
        connectOpts.password = userSSHInfo.password
    }

    try {
        await ssh.connect(connectOpts)
        sshPool.set(key, ssh)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e.message || String(e) }
    }
})

ipcMain.handle('ssh_exec', async (event, sshId, cmd, args, options = {}) => {
    const key = getSshKey(event.sender.id, sshId)
    const ssh = sshPool.get(key)
    if (!ssh) return { ok: false, error: 'not connected' }

    const stdoutChunks = []
    const stderrChunks = []

    try {
        await ssh.exec(cmd, args || [], {
            cwd: options.cwd || undefined,
            onStdout(chunk) {
                stdoutChunks.push(chunk.toString(options.encoding || 'utf8'))
            },
            onStderr(chunk) {
                stderrChunks.push(chunk.toString(options.encoding || 'utf8'))
            }
        })
        return { ok: true, stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') }
    } catch (e) {
        return { ok: false, error: e.message || String(e), stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') }
    }
})

ipcMain.handle('ssh_get_file', async (event, sshId, localPath, remotePath) => {
    const key = getSshKey(event.sender.id, sshId)
    const ssh = sshPool.get(key)
    if (!ssh) return { ok: false, error: 'not connected' }
    try {
        await ssh.getFile(localPath, remotePath)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e.message || String(e) }
    }
})

ipcMain.handle('ssh_put_files', async (event, sshId, fileItems) => {
    const key = getSshKey(event.sender.id, sshId)
    const ssh = sshPool.get(key)
    if (!ssh) return { ok: false, error: 'not connected' }
    try {
        await ssh.putFiles(fileItems)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e.message || String(e) }
    }
})

ipcMain.handle('ssh_put_directory', async (event, sshId, localDir, remoteDir) => {
    const key = getSshKey(event.sender.id, sshId)
    const ssh = sshPool.get(key)
    if (!ssh) return { ok: false, error: 'not connected' }
    try {
        await ssh.putDirectory(localDir, remoteDir, {
            recursive: true,
            concurrency: 10,
            validate: function(itemPath) {
                const baseName = path.basename(itemPath)
                return baseName.substr(0, 1) !== '.' && baseName !== 'node_modules'
            }
        })
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e.message || String(e) }
    }
})

ipcMain.handle('ssh_mkdir', async (event, sshId, remotePath) => {
    const key = getSshKey(event.sender.id, sshId)
    const ssh = sshPool.get(key)
    if (!ssh) return { ok: false, error: 'not connected' }
    try {
        await ssh.mkdir(remotePath)
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e.message || String(e) }
    }
})

ipcMain.handle('ssh_dispose', (event, sshId) => {
    const key = getSshKey(event.sender.id, sshId)
    if (sshPool.has(key)) {
        try { sshPool.get(key).dispose() } catch(e) {}
        sshPool.delete(key)
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

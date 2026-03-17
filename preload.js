const { contextBridge, ipcRenderer } = require('electron')

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('electronAPI', {
    // ---- 主题 ----
    getIsDark: () => ipcRenderer.invoke('get_is_dark'),
    onThemeChanged: (cb) => {
        ipcRenderer.on('themeChanged', (event, isDark) => cb(isDark))
    },

    // ---- 全局共享数据 ----
    getShareData: () => ipcRenderer.invoke('get_share_data'),

    // ---- 窗口操作 ----
    maximizeWindow: () => ipcRenderer.invoke('maximize_window'),

    // ---- 导航 ----
    goSSH: (userSSHInfo) => ipcRenderer.send('go_ssh', userSSHInfo),
    newWin: () => ipcRenderer.send('new_win'),
    onAddSSH: (cb) => {
        ipcRenderer.on('add_ssh', (event, userSSHInfo) => cb(userSSHInfo))
    },

    // ---- 后台任务锁 ----
    setLock: (isAdd) => ipcRenderer.send('set_lock', isAdd),

    // ---- 右键菜单 ----
    showHostMenu: (id) => ipcRenderer.send('show_host_menu', id),
    showFileMenu: (id) => ipcRenderer.send('show_file_menu', id),
    showFolderMenu: (id) => ipcRenderer.send('show_folder_menu', id),
    showFavouriteMenu: (id) => ipcRenderer.send('show_favourite_menu', id),
    showDirMenu: () => ipcRenderer.send('show_dir_menu'),
    showTabMenu: (id) => ipcRenderer.send('show_tab_menu', id),

    // 菜单回调（主进程菜单点击后通知渲染进程）
    onMenuAction: (cb) => {
        ipcRenderer.on('menu_action', (event, action) => cb(action))
    },

    // ---- 文件选择对话框 ----
    showOpenFileDialog: () => ipcRenderer.invoke('show_open_file_dialog'),
    showOpenFilesDialog: () => ipcRenderer.invoke('show_open_files_dialog'),
    showOpenFolderDialog: () => ipcRenderer.invoke('show_open_folder_dialog'),

    // ---- userData 路径 ----
    getUserDataPath: () => ipcRenderer.invoke('get_user_data_path'),

    // ---- 文件 IO（用于配置文件读写）----
    readFile: (filePath) => ipcRenderer.invoke('fs_read_file', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('fs_write_file', filePath, data),
    deleteFile: (filePath) => ipcRenderer.invoke('fs_delete_file', filePath),

    // ---- 本地文件操作 ----
    fsStatSize: (filePath) => ipcRenderer.invoke('fs_stat_size', filePath),
    fsExists: (filePath) => ipcRenderer.invoke('fs_exists', filePath),
    fsUnlink: (filePath) => ipcRenderer.invoke('fs_unlink', filePath),
    openFile: (filePath) => ipcRenderer.invoke('open_file_native', filePath),

    // ==================== SFTP / SSH IPC ====================

    // 连接 & 断开
    sshConnect: (sshId, userSSHInfo) => ipcRenderer.invoke('ssh_connect', sshId, userSSHInfo),
    sshDispose: (sshId) => ipcRenderer.invoke('ssh_dispose', sshId),

    // 远程命令执行（ssh2 exec）
    sshExec: (sshId, cmd, args, options) => ipcRenderer.invoke('ssh_exec', sshId, cmd, args, options),

    // SFTP 文件列表
    sftpList: (sshId, remotePath) => ipcRenderer.invoke('sftp_list', sshId, remotePath),

    // SFTP 文件信息
    sftpStat: (sshId, remotePath) => ipcRenderer.invoke('sftp_stat', sshId, remotePath),

    // SFTP 下载（断点续传），进度通过 onSftpProgress 监听
    sftpDownload: (sshId, remotePath, localPath) => ipcRenderer.invoke('sftp_download', sshId, remotePath, localPath),

    // SFTP 上传单文件（断点续传），进度通过 onSftpProgress 监听
    sftpUpload: (sshId, localPath, remotePath) => ipcRenderer.invoke('sftp_upload', sshId, localPath, remotePath),

    // SFTP 批量上传文件（不带进度，适合小文件）
    sftpPutFiles: (sshId, fileItems) => ipcRenderer.invoke('sftp_put_files', sshId, fileItems),

    // SFTP 上传整个目录
    sftpPutDirectory: (sshId, localDir, remoteDir) => ipcRenderer.invoke('sftp_put_directory', sshId, localDir, remoteDir),

    // SFTP 下载整个目录
    sftpGetDirectory: (sshId, remoteDir, localDir) => ipcRenderer.invoke('sftp_get_directory', sshId, remoteDir, localDir),

    // SFTP 创建目录
    sftpMkdir: (sshId, remotePath) => ipcRenderer.invoke('sftp_mkdir', sshId, remotePath),

    // SFTP 删除文件
    sftpDelete: (sshId, remotePath) => ipcRenderer.invoke('sftp_delete', sshId, remotePath),

    // SFTP 删除目录（递归）
    sftpRmdir: (sshId, remotePath) => ipcRenderer.invoke('sftp_rmdir', sshId, remotePath),

    // SFTP 重命名
    sftpRename: (sshId, oldPath, newPath) => ipcRenderer.invoke('sftp_rename', sshId, oldPath, newPath),

    /**
     * 监听传输进度推送
     * 主进程通过 event.sender.send(`sftp_progress_${sshId}`, { transferred, total, percent }) 推送
     * @param {string} sshId  - 连接标识
     * @param {function} cb   - ({ transferred, total, percent }) => void
     * @returns {function}    - 取消监听的函数
     */
    onSftpProgress: (sshId, cb) => {
        const channel = `sftp_progress_${sshId}`
        const handler = (event, data) => cb(data)
        ipcRenderer.on(channel, handler)
        // 返回取消监听的函数
        return () => ipcRenderer.removeListener(channel, handler)
    },

    // 兼容旧接口（node-ssh 时代），保留给未修改的调用点
    sshGetFile: (sshId, localPath, remotePath) => ipcRenderer.invoke('sftp_download', sshId, remotePath, localPath),
    sshPutFiles: (sshId, fileItems) => ipcRenderer.invoke('sftp_put_files', sshId, fileItems),
    sshPutDirectory: (sshId, localDir, remoteDir) => ipcRenderer.invoke('sftp_put_directory', sshId, localDir, remoteDir),
    sshMkdir: (sshId, remotePath) => ipcRenderer.invoke('sftp_mkdir', sshId, remotePath),
})

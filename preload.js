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

    // ---- SSH 操作（主进程 node-ssh）----
    sshConnect: (sshId, userSSHInfo) => ipcRenderer.invoke('ssh_connect', sshId, userSSHInfo),
    sshExec: (sshId, cmd, args, options) => ipcRenderer.invoke('ssh_exec', sshId, cmd, args, options),
    sshGetFile: (sshId, localPath, remotePath) => ipcRenderer.invoke('ssh_get_file', sshId, localPath, remotePath),
    sshPutFiles: (sshId, fileItems) => ipcRenderer.invoke('ssh_put_files', sshId, fileItems),
    sshPutDirectory: (sshId, localDir, remoteDir) => ipcRenderer.invoke('ssh_put_directory', sshId, localDir, remoteDir),
    sshMkdir: (sshId, remotePath) => ipcRenderer.invoke('ssh_mkdir', sshId, remotePath),
    sshDispose: (sshId) => ipcRenderer.invoke('ssh_dispose', sshId),

    // SSH exec 流式输出（stdout/stderr 实时回调）
    onSshStdout: (cb) => {
        ipcRenderer.on('ssh_stdout', (event, data) => cb(data))
    },
    onSshStderr: (cb) => {
        ipcRenderer.on('ssh_stderr', (event, data) => cb(data))
    },

    // ---- 本地文件操作 ----
    fsStatSize: (filePath) => ipcRenderer.invoke('fs_stat_size', filePath),
    fsExists: (filePath) => ipcRenderer.invoke('fs_exists', filePath),
    fsUnlink: (filePath) => ipcRenderer.invoke('fs_unlink', filePath),
    openFile: (filePath) => ipcRenderer.invoke('open_file_native', filePath),
})

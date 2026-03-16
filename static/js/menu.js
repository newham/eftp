// menu.js — 右键菜单，通过 IPC 让主进程弹出原生菜单，回调通过 onMenuAction 接收

var selected_id = 0
var copy_cmd = 'cp'
var file_id = -1
var folder_id = -1
var favourite_id = -1
var tab_id = -1

// 统一注册菜单动作回调
window.electronAPI.onMenuAction((action) => {
    // console.log('menu action', action)
    switch (action.type) {
        // ---- host menu ----
        case 'host_edit':
            editSSHInfo(userSSH_list[action.id])
            break
        case 'host_delete':
            delSSHInfo(action.id)
            break

        // ---- file menu ----
        case 'file_download': {
            const fileList = getFileList()
            if (action.id < 0 || !fileList[action.id]) return
            download_file(fileList[action.id].name, fileList[action.id].size)
            break
        }
        case 'file_copy': {
            copy_cmd = 'cp'
            const f = getFileList()[action.id]
            copy(f.name)
            break
        }
        case 'file_cut': {
            copy_cmd = 'mv'
            const f = getFileList()[action.id]
            copy(f.name, null, 'mv')
            break
        }
        case 'file_delete': {
            const f = getFileList()[action.id]
            del_file(f.name, f.isDir)
            break
        }
        case 'file_unzip': {
            const f = getFileList()[action.id]
            unzip_file(f.name)
            break
        }
        case 'file_rename': {
            const f = getFileList()[action.id]
            show_rename_dialog(true, f.name)
            break
        }

        // ---- folder menu ----
        case 'folder_copy': {
            copy_cmd = 'cp'
            const folder = getFileList()[action.id]
            copy(folder.name)
            break
        }
        case 'folder_cut': {
            copy_cmd = 'mv'
            const folder = getFileList()[action.id]
            copy(folder.name, null, 'mv')
            break
        }
        case 'folder_delete': {
            if (action.id < 0) return
            const folder = getFileList()[action.id]
            del_file(folder.name, folder.isDir)
            break
        }
        case 'folder_favourite': {
            const folder = getFileList()[action.id]
            favourite_folder(folder.name)
            break
        }
        case 'folder_zip': {
            const folder = getFileList()[action.id]
            zip_folder(folder.name)
            break
        }
        case 'folder_rename': {
            const folder = getFileList()[action.id]
            show_rename_dialog(true, folder.name)
            break
        }

        // ---- favourite menu ----
        case 'favourite_delete':
            del_favourite(action.id)
            break

        // ---- dir menu ----
        case 'dir_paste': {
            const currentDir = getCurrentDir()
            copy(null, currentDir, copy_cmd)
            break
        }

        // ---- tab menu ----
        case 'tab_close':
            closeTab(action.id)
            break
    }
})

function showHostMenu(id) {
    selected_id = id
    window.electronAPI.showHostMenu(id)
}

function showFileMenu(id) {
    file_id = id
    window.electronAPI.showFileMenu(id)
}

function showFolderMenu(id) {
    folder_id = id
    window.electronAPI.showFolderMenu(id)
}

function showFavouriteMenu(id) {
    favourite_id = id
    window.electronAPI.showFavouriteMenu(id)
}

function showDirMenu() {
    window.electronAPI.showDirMenu()
}

function showTabMenu(id) {
    tab_id = id
    window.electronAPI.showTabMenu(id)
}

const { Menu, MenuItem } = remote

const host_menu = new Menu()

var selected_id = 0

var copy_cmd = 'cp'

host_menu.append(new MenuItem({
    label: '编辑',
    click() {
        console.log('edit', selected_id)
        editSSHInfo(userSSH_list[selected_id])
    }
}))
host_menu.append(new MenuItem({ type: 'separator' }))
host_menu.append(new MenuItem({
    label: '删除',
    click() {
        delSSHInfo(selected_id)
    }
}))

// host_menu.append(new MenuItem({ type: 'separator' }))
// host_menu.append(new MenuItem({ //仅供测试用，实际没有意义
//     label: '拷贝',
//     click() {
//         console.log('copy', selected_id)
//         userSSHInfo = userSSH_list[selected_id]
//         userSSHInfo.label += '的副本'
//         userSSHInfo.id = -1
//         saveUserSSHInfo(userSSHInfo)
//     }
// }))

function showHostMenu(id) {
    console.log('show menu', id)
    selected_id = id
        // menuLock = true;
    host_menu.popup({ window: remote.getCurrentWindow() })
}

/* ******file menu******* */
const file_menu = new Menu()

var file_id = -1

file_menu.append(new MenuItem({
    label: '下载',
    click() {
        fileList = getFileList()
        if (file_id < 0 || !fileList[file_id]) { //可能由于没有权限，无法获得文件名
            return
        }
        file_name = fileList[file_id].name
        console.log('download file', file_name)
        download_file(file_name)
    }
}))
file_menu.append(new MenuItem({ type: 'separator' }))
file_menu.append(new MenuItem({
    label: '复制',
    click() {
        copy_cmd = 'cp'
        fileList = getFileList()
        file = fileList[file_id]
        console.log('copy from', file.name)
        copy(file.name)
    }
}))
file_menu.append(new MenuItem({
    label: '剪切',
    click() {
        copy_cmd = 'mv'
        fileList = getFileList()
        file = fileList[file_id]
        console.log('cut from', file.name)
        copy(file.name, null, 'mv')
    }
}))
file_menu.append(new MenuItem({ type: 'separator' }))
file_menu.append(new MenuItem({
    label: '删除',
    click() {
        fileList = getFileList()
        file = fileList[file_id]
        console.log('delete', file.name)
        del_file(file.name, file.isDir)
    }
}))
file_menu.append(new MenuItem({ type: 'separator' }))
file_menu.append(new MenuItem({
    label: '解压',
    click() {
        fileList = getFileList()
        file = fileList[file_id]
        console.log('unzip', file.name)
        unzip_file(file.name)
    }
}))

function showFileMenu(id) {
    file_id = id
    file_menu.popup({ window: remote.getCurrentWindow() })
}

/* ******folder menu******* */

const folder_menu = new Menu()

var folder_id = -1

folder_menu.append(new MenuItem({
    label: '复制',
    click() {
        copy_cmd = 'cp'
        fileList = getFileList()
        folder = fileList[folder_id]
        console.log('copy from', folder.name)
        copy(folder.name)
    }
}))
folder_menu.append(new MenuItem({
    label: '剪切',
    click() {
        copy_cmd = 'mv'
        fileList = getFileList()
        folder = fileList[folder_id]
        console.log('cut from', folder.name)
        copy(folder.name, null, 'mv')
    }
}))
folder_menu.append(new MenuItem({ type: 'separator' }))
folder_menu.append(new MenuItem({
    label: '删除',
    click() {
        if (folder_id < 0) {
            return
        }
        fileList = getFileList()
        folder = fileList[folder_id]
        console.log('delete', folder.name)
        del_file(folder.name, folder.isDir)
    }
}))
folder_menu.append(new MenuItem({ type: 'separator' }))
folder_menu.append(new MenuItem({
    label: '收藏',
    click() {
        fileList = getFileList()
        folder = fileList[folder_id]
        console.log('favourite', folder.name)
        favourite_folder(folder.name)
    }
}))
folder_menu.append(new MenuItem({ type: 'separator' }))
folder_menu.append(new MenuItem({
    label: '压缩',
    click() {
        fileList = getFileList()
        folder = fileList[folder_id]
        console.log('zip', folder.name)
        zip_folder(folder.name)
    }
}))

function showFolderMenu(id) {
    folder_id = id
    folder_menu.popup({ window: remote.getCurrentWindow() })
}

/* ******favourite menu******* */
const favourite_menu = new Menu()

var favourite_id = -1

favourite_menu.append(new MenuItem({
    label: '删除',
    click() {
        if (favourite_id < 0) {
            return
        }
        console.log('delete favourite id', favourite_id)
        del_favourite(favourite_id)
    }
}))

function showFavouriteMenu(id) {
    favourite_id = id
    favourite_menu.popup({ window: remote.getCurrentWindow() })
}

/* ******current dir menu******* */
const dir_menu = new Menu()

dir_menu.append(new MenuItem({
    label: '粘贴',
    click() {
        var currentDir = getCurrentDir()
        console.log(`${copy_cmd} to`, currentDir)
        copy(null, currentDir, copy_cmd)
    }
}))

function showDirMenu() {
    dir_menu.popup({ window: remote.getCurrentWindow() })
}

/* ******tab menu******* */
const tab_menu = new Menu()

var tab_id = -1

tab_menu.append(new MenuItem({
    label: '关闭',
    click() {
        console.log('close', tab_id)
        closeTab(tab_id)
    }
}))

function showTabMenu(id) {
    tab_id = id
    tab_menu.popup({ window: remote.getCurrentWindow() })
}
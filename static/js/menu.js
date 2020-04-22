const { Menu, MenuItem } = remote

const host_menu = new Menu()

var selected_id = 0

host_menu.append(new MenuItem({
    label: '编辑', click() {
        console.log('edit', selected_id)
        editSSHInfo(userSSH_list[selected_id])
    }
}))
host_menu.append(new MenuItem({ type: 'separator' }))
host_menu.append(new MenuItem({
    label: '删除', click() {
        delSSHInfo(selected_id)
    }
}))
host_menu.append(new MenuItem({ type: 'separator' }))
host_menu.append(new MenuItem({
    label: '拷贝', click() {
        console.log('copy', selected_id)
        userSSHInfo = userSSH_list[selected_id]
        userSSHInfo.label += '的副本'
        userSSHInfo.id = -1
        saveUserSSHInfo(userSSHInfo)
    }
}))

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
    label: '下载', click() {
        file_name = fileList[file_id].name
        console.log('download file', file_name)
        download_file(file_name)
    }
}))
file_menu.append(new MenuItem({ type: 'separator' }))
file_menu.append(new MenuItem({
    label: '删除', click() {
        file = fileList[file_id]
        console.log('delete', file.name)
        del_file(file.name, file.isDir)
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
    label: '删除', click() {
        folder = fileList[folder_id]
        console.log('delete', folder.name)
        del_file(folder.name, folder.isDir)
    }
}))

function showFolderMenu(id) {
    folder_id = id
    folder_menu.popup({ window: remote.getCurrentWindow() })
}
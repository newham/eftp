const { dialog } = require('electron').remote

function showOpenFolderWin(f) {
    dialog.showOpenDialog({
        title: "打开文件夹",
        defaultPath: "",
        properties: ['openDirectory'],
        // filters: [
        //     { name: 'Img', extensions: ['png', 'jpg', 'jpeg', 'ico'] },
        // ]
    }).then(result => {
        if (result.filePaths.length < 1) {
            console.log('select folder win closed')
            f(false, '')
            return false
        }
        folder = result.filePaths[0] + '/'
        console.log('select folder', folder)
            // 调用f
        f(true, folder)
    }).catch(err => {
        alert(err)
    })
}

function showOpenFilesWin(f) {
    dialog.showOpenDialog({
        title: "打开文件",
        defaultPath: "",
        properties: ['openFile', 'multiSelections'],
        // filters: [
        //     { name: 'Img', extensions: ['png', 'jpg', 'jpeg', 'ico'] },
        // ]
    }).then(result => {
        if (result.filePaths.length < 1) {
            console.log('select win closed')
            f(false, [])
            return false
        }
        console.log('select folder', result.filePaths)
            // 调用f
        f(true, result.filePaths)
    }).catch(err => {
        alert(err)
    })
}

function showOpenFileWin(f) {
    dialog.showOpenDialog({
        title: "打开文件",
        defaultPath: "",
        properties: ['openFile'],
        // filters: [
        //     { name: 'Img', extensions: ['png', 'jpg', 'jpeg', 'ico'] },
        // ]
    }).then(result => {
        if (result.filePaths.length < 1) {
            console.log('select win closed')
            f(false, '')
            return false
        }
        console.log('select folder', result.filePaths[0])
            // 调用f
        f(true, result.filePaths[0])
    }).catch(err => {
        alert(err)
    })
}
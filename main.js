const { app, BrowserWindow, ipcMain, Menu, MenuItem, nativeTheme, dialog, screen } = require('electron')
const os = require("os");
// 兼容
app.allowRendererProcessReuse = true

// global.data //全局数据
global.shareData = {
        userSSHInfo: {}, //一定要把数据放在结构体里面！！！
        isDark: nativeTheme.shouldUseDarkColors,
    } //用于共享

let processLock = 0

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
                { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
                { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
                { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
                { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" },
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
    // 设置menu
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))

    //如果os是mac，设置dock
    if (os.type == 'Darwin') {
        return //不设置dock
        app.dock.setMenu(Menu.buildFromTemplate([{
            label: '新HOST',
            click() {
                createWindow()
            }
        }]))
    }
}

function createWindow() {
    createMenu() // 创建菜单
    return createIndexWindow() // 创建窗口
}

function createIndexWindow() {
    // 默认值
    let win_w = 1100
    let minWidth = 900
    let height = 768
    let minHeight = 600
    let x = null
    let y = null

    // 如果已有窗口，则保持原位置
    if (BrowserWindow.getAllWindows().length > 0 && BrowserWindow.getFocusedWindow()) {
        let size = BrowserWindow.getFocusedWindow().getSize()
        let position = BrowserWindow.getFocusedWindow().getPosition()
        win_w = size[0]
        height = size[1]
        x = position[0]
        y = position[1]
    }

    // 创建浏览器窗口
    const win = new BrowserWindow({
        title: "Eftp",
        titleBarStyle: "hiddenInset", //不显示标题栏,仅显示按钮
        // transparent:true, //透明度
        // opacity:0.99,
        x: x,
        y: y,
        width: win_w,
        minWidth: minWidth,
        height: height,
        minHeight: minHeight,
        webPreferences: {
            nodeIntegration: true //enable node js
        }
    })

    win.on('close', (event) => {
        // console.log('close win', win.id, locked)
        if (processLock > 0 && BrowserWindow.getAllWindows().length == 1) {
            event.preventDefault()
            dialog.showMessageBox(win, {
                buttons: ["OK", "Cancel"],
                message: `有${processLock}个后台任务正在进行,确定退出?`,
                cancelId: 1,
            }).then((result) => {
                if (result.response == 0) { //ok
                    win.destroy()
                }
            })
        }
    })

    // 并且为你的应用加载index.html
    win.loadFile('login.html')

    // 打开开发者工具
    if (process.argv.includes('-t')) {
        win.webContents.openDevTools()
    }

    return win.id
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
    // 否则绝大部分应用及其菜单栏会保持激活。
    // if (process.platform !== 'darwin') {
    //     app.quit()
    // }
    // mac也直接退出
    app.quit()
})

app.on('activate', () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
    // else {
    //     //使最后创建的窗口激活
    //     BrowserWindow.getAllWindows()[BrowserWindow.getAllWindows().length - 1].focus()
    // }
})

// Attempt to bind file opening #2
app.on('will-finish-launching', () => {

});

// 主进程 消息队列 —— 一般用于渲染进程无法操作，通知主进程操作
ipcMain.on('go_ssh', (event, userSSHInfo) => {
    current_win = BrowserWindow.getFocusedWindow()
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

ipcMain.on('new_win', (event) => {
    // console.log('new win')
    createWindow()
})

ipcMain.on('set_lock', (event, isAdd) => {
    if (isAdd) {
        processLock += 1
    } else {
        processLock -= 1
    }
    // console.log('set_lock', processLock)
})

//切换暗-亮模式触发
nativeTheme.on('updated', () => {
    setTheme(nativeTheme.shouldUseDarkColors)
})

function setTheme(isDark) {
    BrowserWindow.getAllWindows().forEach((win) => {
        //设置share变量
        global.shareData.isDark = isDark
        win.webContents.send('themeChanged', isDark)
    })
}

//监听拖放事件
ipcMain.on('ondragstart', (event, filePath) => {
    console.log('drag', filePath)
})
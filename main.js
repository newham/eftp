const { app, BrowserWindow, ipcMain, Menu, MenuItem, nativeTheme, dialog, screen } = require('electron')

// global.data //全局数据
global.shareData = {
    userSSHInfo: {}, //一定要把数据放在结构体里面！！！
    isDark: nativeTheme.shouldUseDarkColors
} //用于共享

function createMenu() {
    var template = [
        {
            label: "Estp",
            submenu: [
                {
                    label: "关于", click: function () {
                        app.showAboutPanel()
                    }
                },
                { type: 'separator' },
                { label: "退出", accelerator: "CmdOrCtrl+Q", click: function () { app.quit() } },
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
                { label: "Light Theme", click: function () { setTheme(false) }},
                { label: "Dark Theme", click: function () { setTheme(true) }},
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
    //设置dock
    const dockMenu = Menu.buildFromTemplate([
        {
            label: '新窗口',
            click() {
            }
        }
    ])
    app.dock.setMenu(dockMenu)
}

function createWindow() {
    // 创建菜单
    createMenu()
    // 创建窗口
    createIndexWindow()
}

function createIndexWindow() {
    // 创建浏览器窗口
    const win = new BrowserWindow({
        title: "Eftp",
        titleBarStyle: "hiddenInset", //不显示标题栏,仅显示按钮
        // transparent:true, //透明度
        // opacity:0.99,
        width: 1024,
        minWidth: 612,
        height: 768,
        minHeight: 384,
        webPreferences: {
            nodeIntegration: true //enable node js
        }
    })

    // 并且为你的应用加载index.html
    // win.loadURL(`file://${__dirname}/index.html`)
    win.loadFile('login.html')

    // 打开开发者工具
    if (process.argv.includes('-t')) {
        win.webContents.openDevTools()
    }
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
})

// Attempt to bind file opening #2
app.on('will-finish-launching', () => {

});

// 主进程 消息队列 —— 一般用于渲染进程无法操作，通知主进程操作
ipcMain.on('go_ssh', (event, userSSHInfo) => {
    // console.log('go_ssh:', userSSHInfo)
    global.userSSHInfo = userSSHInfo
    BrowserWindow.getFocusedWindow().loadFile('index.html')
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
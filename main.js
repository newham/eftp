const { app, BrowserWindow, ipcMain, Menu, MenuItem, nativeTheme, dialog, screen } = require('electron')
const fs = require('fs');

// global.data //全局数据

function createMenu() {
    var template = [
        {
            label: "Demo",
            submenu: [
                { label: "退出", accelerator: "CmdOrCtrl+Q", click: function () { app.quit() } },
                { type: 'separator' },
                {
                    label: "关于", click: function () {
                        app.showAboutPanel()
                    }
                },
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
        title: "demo",
        titleBarStyle: "hiddenInset",
        // transparent:true, //透明度
        // opacity:0.99,
        width: 1024,
        minWidth: 512,
        height: 768,
        minHeight: 384,
        webPreferences: {
            nodeIntegration: true
        }
    })

    // 并且为你的应用加载index.html
    win.loadFile('index.html')

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

// 主进程 消息队列
ipcMain.on('test', (event, id) => {
    console.log('call back from win:', id)
    showOpenFileWin((ok) => {
        if (ok) {
            resetGlobalData(id)
            event.reply('openImg-cb', 'ok')
        } else {
            event.reply('openImg-cb', 'failed')
        }
    })
})

//切换暗-亮模式触发
nativeTheme.on('updated', () => {
    isDark = nativeTheme.shouldUseDarkColors
    BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('themeChanged', isDark)
    })
})

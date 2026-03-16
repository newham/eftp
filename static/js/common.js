// common.js — 渲染进程公共工具，不再使用 remote 模块

async function setTheme() {
    const theme = document.getElementById('theme-css')
    if (!theme) return
    const shareData = await window.electronAPI.getShareData()
    if (shareData && shareData.isDark) {
        theme.href = 'static/css/dark.css'
    } else {
        theme.href = 'static/css/light.css'
    }
}

// 监听主进程下发的主题变更
window.electronAPI.onThemeChanged((isDark) => {
    console.log("themeChanged: isDark", isDark)
    const theme = document.getElementById('theme-css')
    if (!theme) return
    if (isDark) {
        theme.href = 'static/css/dark.css'
    } else {
        theme.href = 'static/css/light.css'
    }
})

var max = false

function maxWindow() {
    window.electronAPI.maximizeWindow()
    max = !max
}

function appendHTMLByID(id, html) {
    document.getElementById(id).insertAdjacentHTML('beforeend', html)
}

function setHTMLByID(id, html) {
    document.getElementById(id).innerHTML = html
}

function addClassByID(id, c) {
    document.getElementById(id).classList.add(c)
}

function delClassByID(id, c) {
    document.getElementById(id).classList.remove(c)
}

function show(id, isShow) {
    if (isShow) {
        document.getElementById(id).style.display = 'block'
    } else {
        document.getElementById(id).style.display = 'none'
    }
}

// 文件选择对话框（单个）
async function showOpenFileWin(cb) {
    const result = await window.electronAPI.showOpenFileDialog()
    cb(result.ok, result.ok ? result.file : null)
}

// 文件选择对话框（多个）
async function showOpenFilesWin(cb) {
    const result = await window.electronAPI.showOpenFilesDialog()
    cb(result.ok, result.ok ? result.files : null)
}

// 文件夹选择对话框
async function showOpenFolderWin(cb) {
    const result = await window.electronAPI.showOpenFolderDialog()
    cb(result.ok, result.ok ? result.folder : null)
}

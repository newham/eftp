// drag.js — 拖放上传
// Electron 32+ 的 contextIsolation 模式下 File.path 已被移除，
// 必须通过 preload 暴露的 webUtils.getPathForFile(file) 获取真实路径。

document.getElementById('drag_box').addEventListener('drop', (e) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
        const file_list = []
        for (let i = 0; i < files.length; i++) {
            // 使用 webUtils.getPathForFile 获取真实本地路径
            const filePath = window.electronAPI.getPathForFile(files[i])
            if (filePath) file_list.push(filePath)
        }
        if (file_list.length > 0) {
            upload_file(file_list)
        }
    }
    showDargBox(false)
})

// 必须阻止默认行为，dragover 才能触发 drop
document.getElementById('drag_area').addEventListener('dragover', (e) => {
    e.preventDefault()
    showDargBox(true)
})

// 拖拽文件放到 drag_area 背景区（不是 drag_box）时，关闭遮罩
document.getElementById('drag_area').addEventListener('drop', (e) => {
    e.preventDefault()
    showDargBox(false)
})

// 拖拽离开整个窗口时，关闭遮罩（防止卡住）
document.addEventListener('dragleave', (e) => {
    // relatedTarget 为 null 表示真正离开了窗口
    if (e.relatedTarget === null) {
        showDargBox(false)
    }
})

function showDargBox(isShow) {
    document.getElementById('drag_box').style.display = isShow ? 'block' : 'none'
}

// 键盘 ESC 关闭遮罩
document.onkeydown = (event) => {
    if ((event || window.event).keyCode === 27) {
        showDargBox(false)
    }
}

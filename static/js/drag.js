document.getElementById('drag_box').addEventListener("drop", (e) => {
    console.log('drag')
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        var file_list = []
        var alert_file_list = []
        for (i = 0; i < files.length; i++) {
            file_list.push(files[i].path)
            alert_file_list.push('--' + getFileName(files[i].path))
        }
        var deng = ''
        if (file_list.length > 10) {
            deng = '...'
        }
        // if (confirm('确定上传:\n{0}\n{1}文件\n到:{2}?'.format(alert_file_list.slice(0, 10).join('\n'), deng, currentDir))) {
        //     upload_file(file_list)
        // }
        upload_file(file_list) //跳过确定直接上传
        showDargBox(false)
    }
})

//很重要！屏蔽默认操作才能有事件触发（拖到外面的drag_box上时显示drag_area区域）
document.getElementById('drag_area').addEventListener("dragover", (e) => {
    e.preventDefault();
    showDargBox(true)
})

//离开区域(放到外面的drag_box上)
document.getElementById('drag_area').addEventListener("drop", (e) => {
    e.preventDefault();
    showDargBox(false)
})

function showDargBox(isShow) {
    if (isShow) {
        document.getElementById('drag_box').style.display = 'block'
    } else {
        document.getElementById('drag_box').style.display = 'none'
    }
}

// 监听键盘事件
document.onkeydown = (event) => {
    event = event || window.event;/*||为或语句，当IE不能识别event时候，就执行window.event 赋值*/
    // console.log(event.keyCode);
    switch (event.keyCode) {/*keyCode:字母和数字键的键码值*/
        case 27:
            //esc
            showDargBox(false)
            break;
        /*37、38、39、40分别对应左上右下*/
        // case 37:
        // case 38:
        //     previous()
        //     break;
        // case 39:
        // case 40:
        //     next()
        //     break;
    }
}

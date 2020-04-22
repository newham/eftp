var remote = require('electron').remote;
const node_ssh = require('node-ssh')
const path = require("path");
// const readline = require('readline');

var ssh = new node_ssh()

var userSSHInfo = remote.getGlobal('shareData').userSSHInfo

var fileList = []

const loading_html = '<img src="static/img/loading.gif">'

let getHome = () => {
    if (userSSHInfo.username == "root") {
        return "/root/"
    }
    return "/home/" + userSSHInfo.username + "/"
}

function getLock() {
    return remote.getGlobal('shareData').processLocks[remote.getCurrentWindow().id - 1]
}

function addLock(isLock) {
    locks = remote.getGlobal('shareData').processLocks
    locks[remote.getCurrentWindow().id - 1] = isLock
    remote.getGlobal('shareData').processLocks = locks
}

function showProcess(id) {
    addLock(true)
    document.getElementById('infos').innerHTML += '<p id="{0}">{1}</p>'.format(id, loading_html)
}

function doneProcess(id, msg = 'success', files = '') {
    txt_class = 'txt-success'
    if (msg == 'error') {
        txt_class = 'txt-danger'
    }
    if (files != "") {
        msg += ' : ' + files
    }
    document.getElementById(id).innerHTML = msg
    document.getElementById(id).classList.add(txt_class)
    addLock(false)
}

function addInfo(msg, file = '') {
    p_html = '<p>'
    if (msg.indexOf('error') != -1) {
        p_html = '<p class="txt-danger">'
    } else if (msg.indexOf('success') != -1) {
        p_html = '<p class="txt-success">'
    }
    if (file != "") {
        file = ' : ' + file
    }
    document.getElementById('infos').innerHTML += p_html + msg + file + '</p>\n'
    //滑动到底部
    sidebar = document.getElementById('sidebar')
    sidebar.scrollTop = sidebar.scrollHeight;
}

var currentDir = getHome()

let showPath = (path) => {
    // console.log('path', path.split('/'))
    document.querySelector('#path').innerHTML = path
}

function ls(dir) {
    //dir = "" 刷新
    //clean
    document.querySelector('#file_list').innerHTML = ""
    fileList = []
    // start
    if (dir) {
        if (dir == "../") {
            currentDir = getParentPath(currentDir)
        } else if (dir == '$HOME') {
            currentDir = getHome()
        } else {
            currentDir = currentDir + dir + "/"
        }
    }
    //set path
    showPath(currentDir)
    //get parent path
    parentPath = getParentPath(currentDir)
    // console.log(currentDir)
    // addInfo('ls', currentDir)
    ssh.exec('ls', ['-lh', currentDir], {
        onStdout(chunk) {
            //add ../ to list
            if (currentDir != "/") {
                //add up
                up_file = init_fileInfo()
                up_file.name = "../"
                up_file.isDir = true
                setFileInfo(up_file)
            }
            //parse ls
            read_line(chunk, userSSHInfo.characterSet, (line, i) => {
                parse_ls_line(line, i)
            })
        }, onStderr(chunk) {
            console.log('stderrChunk', chunk.toString(userSSHInfo.characterSet))
        }
    }).then(() => {
        // addInfo('success')
    }).catch((res) => {
        console.log("exception", res)
        addInfo('error', res)
    })
}

let read_line = (chunk = new Buffer(), encoding = 'utf8', f) => {
    line_num = 0
    feed_index = 0
    while ((feed_index = chunk.indexOf('\n')) > 0) {
        line_str = chunk.slice(0, feed_index).toString(encoding)
        f(line_str, line_num++)
        chunk = chunk.slice(feed_index + 1)
    }
}

let parse_ls_line = (line, id) => {
    line = line.replace(/\s+/g, ' ') //多个空格替换为一个空格的正则实例
    attrs = line.split(' ')
    set_fileInfo(attrs, id)
}

let init_fileInfo = () => {
    return {
        rights: "",
        fileCount: 0,
        user: "",
        group: "",
        size: "-",
        month: "",
        day: "",
        year: "",
        name: "",
        isDir: false,
        id: -1
    }
}

let set_fileInfo = (attrs = [], id) => {
    if (attrs.length < 9) {
        return
    }

    var fileInfo = init_fileInfo()

    fileInfo.rights = attrs[0]
    fileInfo.isDir = fileInfo.rights.startsWith('d')
    fileInfo.fileCount = parseInt(attrs[1])
    fileInfo.user = attrs[2]
    fileInfo.group = attrs[3]
    fileInfo.size = attrs[4]
    fileInfo.month = attrs[5]
    fileInfo.day = attrs[6]
    fileInfo.year = attrs[7]
    fileInfo.name = attrs.slice(8).join(' ')
    fileInfo.id = id

    setFileInfo(fileInfo)
}

function getFileHTML(fileInfo) {
    if (fileInfo.isDir) {
        tr_html = '<tr oncontextmenu="showFolderMenu({0})">'.format(fileInfo.id)
        if (fileInfo.name == "../") {
            tr_html = '<tr>'
        }
        return '{0}<td class="td-icon"><img class="icon" src="static/img/folder_mac.png"></td><td class="td-head" colspan="3"><a onclick="ls(\'{1}\')" href="#"><div>{1}</div></a></td></div>'.format(tr_html, fileInfo.name)
    } else {
        return '<tr oncontextmenu="showFileMenu({0})"><td class="td-icon"><img class="icon" src="static/img/file.png"></td><td class="td-head"><div>{1}</div></td><td>{2}B</td><td class="td-download"><a href="#" onclick="download_file(\'{1}\')"><img class="icon" src="static/img/download.png"></a></div>'.format(fileInfo.id, fileInfo.name, fileInfo.size)
    }
}

function setFileInfo(fileInfo) {
    //push to list
    fileList.push(fileInfo)
    //set html
    document.querySelector('#file_list').innerHTML += getFileHTML(fileInfo)
}

function getParentPath(file) {
    if (file == "" || file == "/") {
        return file
    }
    var i = file.lastIndexOf("/");
    if (i == file.length - 1) {
        file = file.slice(0, file.length - 2)
    }
    i = file.lastIndexOf("/");
    // return file.substr(obj+1);//文件名
    return file.substr(0, i + 1) //路径
}

function upload_file(files) {
    fileItems = []
    files.forEach(f => {
        console.log(currentDir + getFileName(f))
        fileItems.push({ local: f, remote: currentDir + getFileName(f) })
    });
    addInfo('upload', '-' + files.join("\n-"))
    id = sha1(files.join(','))
    showProcess(id)
    // setTimingProcess()
    // setProcess(20)
    ssh.putFiles(fileItems).then(function () {
        console.log("The File thing is done")
        doneProcess(id)
        // addInfo('success')
        ls('')
    }, function (error) {
        console.log("Something's wrong", error)
        doneProcess(id, 'error', error)
    }).catch((res) => {
        doneProcess(id, 'error', res)
    })
}

function upload() {
    showOpenFilesWin((ok, files) => {
        if (ok) {
            upload_file(files)
        }
    })
}

function getFolderName(path) {
    paths = path.split('/')
    return paths[paths.length - 2] + '/'
}

function upload_folder() {
    showOpenFolderWin((ok, folder) => {
        toFolder = currentDir + getFolderName(folder)
        if (ok) {
            console.log(folder, 'to', toFolder)
            id = sha1(folder)
            addInfo('upload', folder)
            showProcess(id)
            // return
            ssh.putDirectory(folder, toFolder, {
                recursive: true,
                concurrency: 10,
                validate: function (itemPath) {
                    const baseName = path.basename(itemPath)
                    return baseName.substr(0, 1) !== '.' && // do not allow dot files
                        baseName !== 'node_modules' // do not allow node_modules
                },
                tick: function (localPath, remotePath, error) {
                    if (error) {
                        console.log(localPath, error)
                    } else {
                        console.log('ok')
                    }
                }
            }).then(function (status) {
                console.log('the directory transfer was', status ? 'successful' : 'unsuccessful')
                // addInfo('success')
                doneProcess(id)
                ls("")//刷新列表
                finishProcess()
            }).catch((res) => {
                doneProcess(id, 'error', res)
            })
        }
    })
}

function download_file(file) {
    showOpenFolderWin((ok, folder) => {
        addInfo('download', file)
        id = sha1(file)
        showProcess(id)
        ssh.getFile(folder + file, currentDir + file).then(function (Contents) {
            console.log("The File", file, "successfully downloaded")
            // addInfo('success')
            doneProcess(id)
        }, function (error) {
            console.log("Something's wrong")
            console.log(error)
        }).catch((res) => {
            doneProcess(id, 'error', res)
        })
    })

}

function del_file(file, isDir) {
    f_tag = isDir ? "文件夹" : "文件"
    if (!confirm('确定删除-{0}-[{1}] ?'.format(f_tag, file))) {
        return
    }
    var tag = '-f'
    if (isDir) {
        tag = '-dr'
    }
    addInfo('rm', file)
    ssh.exec('rm', [tag, currentDir + file], {
        onStdout(chunk) {
            read_line(chunk, userSSHInfo.characterSet, (line, i) => {
                addInfo('status', line)
            })
        }, onStderr(chunk) {
            chunk_str = chunk.toString(userSSHInfo.characterSet)
            console.log('stderrChunk', chunk_str)
            addInfo('error', chunk_str)
        }
    }).then(() => {
        addInfo('success', '')
        ls("")
    }).catch((res) => {
        console.log("exception", res)
        addInfo('error', res)
    })
}

function getFileName(file) {
    if (file == "") {
        return ""
    }
    var obj = file.lastIndexOf("/");
    return file.substr(obj + 1);//文件名
}

function show_dialog(isShow) {
    if (isShow) {
        document.getElementById('new_folder_dialog').style.display = 'block'
        document.getElementById('dir_name').focus()
    } else {
        document.getElementById('new_folder_dialog').style.display = 'none'
        document.getElementById('dir_name').value = ''
    }

}

function keydown_mkdir() {
    if (event.keyCode == 13) {
        mkdir()
    } else if (event.keyCode == 27) {
        show_dialog(false)
    }
}

function checkRename(filename, isDir) {
    isRename = false
    fileList.forEach((file) => {
        if (file.name == filename && file.isDir == isDir) {
            isRename = true
        }
    })
    return isRename
}

function mkdir() {
    dir_name = document.getElementById('dir_name').value
    if (!dir_name || dir_name == "") {
        show_dialog(false)
        return
    }
    //检查重名
    if (checkRename(dir_name, true)) {
        alert('文件名重复')
        return
    }
    addInfo('mkdir', dir_name)
    //mkdir by ssh
    ssh.mkdir(currentDir + dir_name).then(function () {
        console.log("mkdir success", dir_name)
        addInfo('success')
        // ls(dir_name) //进入该文件夹
        ls("")//只刷新目录
    }, function (error) {
        console.log(error)
        addInfo('error', error)
    })
    show_dialog(false)
}

function to_login() {
    ipcRenderer.send('new_win')
    // ****old*****
    // if (!confirm("确定断开连接,并返回主页？")) {
    //     return
    // }
    // ssh.dispose()
    // // document.body.innerHTML = ""
    // window.location.href = 'login.html'
}

function connectSSH() {
    addInfo('connect', '{0}@{1}:{2}'.format(userSSHInfo.username, userSSHInfo.host, userSSHInfo.port))
    ssh.connect({
        host: userSSHInfo.host,
        username: userSSHInfo.username,
        password: userSSHInfo.password,
        privateKey: userSSHInfo.privateKey,
        port: userSSHInfo.port,
    }).then(() => {
        console.log("connect success!")
        addInfo("success")
        ls("")
    }, function (error) {
        console.log("connect failed!", error)
        addInfo("error", error)
    })
}

function setTitle() {
    document.getElementById('head-title').innerHTML = userSSHInfo.label
}

function clean_infos() {
    if(!getLock()){
        document.getElementById('infos').innerHTML = ''
    }
}

//设置窗口标题
setTitle()
//设置主题
setTheme()
//加载list
connectSSH()
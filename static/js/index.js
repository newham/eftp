var remote = require('electron').remote;
const node_ssh = require('node-ssh')
const path = require("path");
// const readline = require('readline');

var ssh = new node_ssh()

var userSSHInfo = remote.getGlobal('shareData').userSSHInfo

var fileList = []

let getHome = () => {
    if (userSSHInfo.username == "root") {
        return "/root/"
    }
    return "/home/" + userSSHInfo.username + "/"
}

function addInfo(msg, file) {
    document.getElementById('infos').innerHTML += '<p>' + msg + ' : ' + file + '</p>\n'
}

var currentDir = getHome()

let showPath = (path) => {
    // console.log('path', path.split('/'))
    document.querySelector('#path').innerHTML = path
}

let ls = (dir) => {
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

    if (currentDir != "/") {
        //add up
        up_file = init_fileInfo()
        up_file.name = "../"
        up_file.isDir = true
        setFileInfo(up_file)
    }
    // console.log(currentDir)
    ssh.exec('ls', ['-lh', currentDir], {
        onStdout(chunk) {
            read_line(chunk, userSSHInfo.characterSet, (line, i) => {
                parse_ls_line(line, i)
            })
        }, onStderr(chunk) {
            console.log('stderrChunk', chunk.toString(userSSHInfo.characterSet))
        }
    }).catch((res) => {
        console.log("exception", res)
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
        return '<tr><td class="td-icon"><img class="icon" src="static/img/folder_mac.png"></td><td class="td-head" colspan="3"><a onclick="ls(\'{0}\')" href="#"><div>{0}</div></a></td></div>'.format(fileInfo.name)
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

function upload() {
    showOpenFilesWin((ok, files) => {
        if (ok) {
            fileItems = []
            files.forEach(f => {
                console.log(currentDir + getFileName(f))
                fileItems.push({ local: f, remote: currentDir + getFileName(f) })
            });
            addInfo('正在上传', files.join(","))
            ssh.putFiles(fileItems).then(function () {
                console.log("The File thing is done")
                addInfo('上传完成', files.join(","))
                ls('')
            }, function (error) {
                console.log("Something's wrong")
                console.log(error)
            })
        }
    })
}
function upload_folder() {
    showOpenFolderWin((ok, folder) => {
        if (ok) {
            console.log(folder, currentDir)
            addInfo('正在上传文件夹', folder)
            // return
            ssh.putDirectory(folder, currentDir, {
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
                addInfo('上传文件夹成功', folder)
                ls("")
            })
        }
    })
}



function download_file(file) {
    showOpenFolderWin((ok, folder) => {
        addInfo('正在下载', file)
        ssh.getFile(folder + file, currentDir + file).then(function (Contents) {
            console.log("The File", file, "successfully downloaded")
            addInfo('下载完成', file)
        }, function (error) {
            console.log("Something's wrong")
            console.log(error)
        })
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
    } else {
        document.getElementById('new_folder_dialog').style.display = 'none'
    }

}

function mkdir() {
    dir_name = document.getElementById('dir_name').value
    if (dir_name == "") {
        show_dialog(false)
        return
    }
    ssh.mkdir(dir_name).then(function () {
        console.log("mkdir success", dir_name)
        addInfo('mkdir success', dir_name)
        ls(dir_name)
    }, function (error) {
        console.log(error)
        addInfo('mkdir error', dir_name)
    })
    show_dialog(false)
}

function to_login() {
    if (!confirm("确定断开连接,并返回主页？")) {
        return
    }
    ssh.dispose()
    // document.body.innerHTML = ""
    window.location.href = 'login.html'
}

function connectSSH() {
    addInfo('start to connect , use key', userSSHInfo.ssh)
    ssh.connect({
        host: userSSHInfo.host,
        username: userSSHInfo.username,
        password: userSSHInfo.password,
        privateKey: userSSHInfo.privateKey,
        port: userSSHInfo.port,
    }).then(() => {
        console.log("connect success!")
        addInfo("connect success!", userSSHInfo.host)
        addInfo("user is", userSSHInfo.username)
        ls("")
    }, function (error) {
        console.log("connect failed!", error)
        addInfo("connect failed!" + userSSHInfo.host, r)
    })

}

//设置主题
setTheme()
//加载list
connectSSH()
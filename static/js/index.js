var remote = require('electron').remote;
const node_ssh = require('node-ssh')
const path = require("path");
// const readline = require('readline');
// ---------------data---------------
var ssh_list = []

const ls_history_max = 100

const max_infos_num = 100

var ssh_index = -1

const loading_html = '<img class="img-loading" src="static/img/loading.gif">'

function getCurrentDir() {
    return ssh_list[ssh_index].currentDir
}

function setCurrentDir(dir) {
    ssh_list[ssh_index].currentDir = dir
}

function getUserSSHInfo(id = ssh_index) {
    return ssh_list[id].userSSHInfo
}

function setUserSSHInfo(userSSHInfo) {
    ssh_list[ssh_index].userSSHInfo = userSSHInfo
}

function getSSH(id = ssh_index) {
    return ssh_list[id].ssh
}

function setSSH(ssh) {
    ssh_list[ssh_index].ssh = ssh
}

function put_ls_history(current, dir) {
    ssh_list[ssh_index].ls_history.push({ currentDir: current, dir: dir })
}

function get_ls_history() {
    return ssh_list[ssh_index].ls_history
}

function setIsShowHidden(isShow) {
    ssh_list[ssh_index].isShowHidden = isShow
}

function getIsShowHidden() {
    return ssh_list[ssh_index].isShowHidden
}

function plusInfos_count(n) {
    ssh_list[ssh_index].infos_count += n
}

function resetInfos_count() {
    ssh_list[ssh_index].infos_count = 0
}

function getInfos_count() {
    return ssh_list[ssh_index].infos_count
}

function resetFileList() {
    ssh_list[ssh_index].fileList = []
}

function getFileList() {
    return ssh_list[ssh_index].fileList
}

function setBackIndex(index) {
    return ssh_list[ssh_index].backIndex = index
}

function getBackIndex() {
    return ssh_list[ssh_index].backIndex
}

function get_ls_lock() {
    return ssh_list[ssh_index].ls_lock
}

function set_ls_lock(lock) {
    ssh_list[ssh_index].ls_lock = lock
}

// ---------------data---------------


function getHome(username) {
    // console.log('get home', username)
    if (username == "root") {
        return "/root/"
    }
    return "/home/" + username + "/"
}

function getLock() {
    return remote.getGlobal('shareData').processLocks[remote.getCurrentWindow().id - 1]
}

function addLock(isLock = false) {
    locks = remote.getGlobal('shareData').processLocks
    i = remote.getCurrentWindow().id - 1
    if (isLock) {
        locks[i] += 1
    } else {
        locks[i] += -1
    }
    remote.getGlobal('shareData').processLocks = locks
}

function doProcess(id, tg = 'success', msg = '') {
    //clean
    document.getElementById(id).classList.remove('txt-success', 'txt-danger', 'txt-info')
    //set class
    txt_class = 'txt-success'
    if (tg == 'failed') {
        txt_class = 'txt-danger'
    } else if (tg == 'info') {
        txt_class = 'txt-info'
    }
    if (tg == 'success' || tg == 'failed') {
        addLock(false)
    }
    if (msg != "") {
        msg = ' : ' + msg
    }
    if (tg == 'success') {
        document.getElementById(id).style.padding = 0;
        document.getElementById(id).innerHTML = ''
    } else {
        document.getElementById(id).innerHTML = tg + msg
        document.getElementById(id).classList.add(txt_class)
    }
    //count
    // console.log(infos_count)
    if (getInfos_count() > max_infos_num) {
        clean_infos()
    }
}

function addInfo(msg, file = '', isArray = false) {
    //get file
    if (isArray) {
        file = file.join(',')
    }
    // if (file != "") {
    //     file = ' : ' + file
    // }
    //sha1 a id
    var id = new Date().getTime()
    document.getElementById('infos').innerHTML += '<div class="line-div"><p><label>{0}</label>{1}</p><p id="{2}">{3}</p></div>'.format(msg, file, id, loading_html)
    //滑动到底部
    sidebar = document.getElementById('sidebar')
    sidebar.scrollTop = sidebar.scrollHeight;
    //加锁，退出提示，禁止清空
    addLock(true)
    //infos_count++
    plusInfos_count(1)
    return id
}

let showPath = (path) => {
    // console.log('path', path.split('/'))
    document.querySelector('#path').innerHTML = path
}

function ls(dir, isShow = getIsShowHidden()) {
    if (get_ls_lock()) {
        return
    }
    //dir = "" 刷新
    document.querySelector('#file_list').innerHTML = ""
    resetFileList()
    //
    backIndex = getBackIndex()
    ls_history = get_ls_history()
    currentDir = getCurrentDir()
    if (dir) {
        if (dir == "..") {
            setCurrentDir(getParentPath(currentDir))
        } else if (dir == '$HOME') {
            setCurrentDir(getHome(getUserSSHInfo().username))
        } else if (dir == '-1') {
            if (backIndex < ls_history.length - 1) {
                backIndex += 2
            }
            back = ls_history[ls_history.length - backIndex]
            // console.log('back', back)
            if (back && back.currentDir != currentDir) {
                // console.log('ls back', back.currentDir)
                setCurrentDir(back.currentDir)
            }
        } else {
            if (dir != '') {
                backIndex = 0
            }
            setCurrentDir(currentDir + dir + "/")
        }
    }
    setBackIndex(backIndex)
    put_ls_history(getCurrentDir(), dir)
    // console.log('add history', currentDir, ls_history.length)

    //setlock
    set_ls_lock(true)
    //set path
    showPath(getCurrentDir())
    //get parent path
    // parentPath = getParentPath(getCurrentDir())
    // console.log('ls', currentDir)
    id = addInfo('ls', getCurrentDir())
    //arg
    arg = '-lh'
    if (isShow) {
        arg = '-lha'
    }
    getSSH().exec('ls', [arg, getCurrentDir()], {
        onStdout(chunk) {
            //add ../ to list
            if (getCurrentDir() != "/" && !isShow) {
                //add up
                up_file = init_fileInfo()
                up_file.name = ".."
                up_file.isDir = true
                setFileInfo(up_file)
            }
            //parse ls
            read_line(chunk, getUserSSHInfo().characterSet, (line, i) => {
                parse_ls_line(line, i)
            })
        }, onStderr(chunk) {
            // console.log('stderrChunk', chunk.toString(getUserSSHInfo().characterSet))
        }
    }).then(() => {
        // addInfo('success')
        doProcess(id)
        set_ls_lock(false)
    }).catch((res) => {
        // console.log("exception", res)
        doProcess(id, 'failed', res)
        set_ls_lock(false)
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
    //set font color
    font_class = ""
    if (fileInfo.name.startsWith('.')) {
        font_class = 'font-light'
    }
    if (fileInfo.isDir) {
        tr_html = '<tr oncontextmenu="showFolderMenu({0})">'.format(fileInfo.id)
        if (fileInfo.name == "..") {
            tr_html = '<tr>'
        }
        return '{0}<td class="td-icon"><img class="icon" src="static/img/folder_mac.png"></td><td class="td-head" colspan="3"><a onclick="ls(\'{2}\')" href="#"><div class="{1}">{2}</div></a></td></div>'.format(tr_html, font_class, fileInfo.name)
    } else {
        return '<tr oncontextmenu="showFileMenu({0})"><td class="td-icon"><img class="icon" src="static/img/file.png"></td><td class="td-head"><div class="{1}">{2}</div></td><td>{3}B</td><td class="td-download"><a href="#" onclick="download_file(\'{2}\')"><img class="icon" src="static/img/download.png"></a></div>'.format(fileInfo.id, font_class, fileInfo.name, fileInfo.size)
    }
}

function setFileInfo(fileInfo) {
    //push to list
    ssh_list[ssh_index].fileList.push(fileInfo)
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
        // console.log(currentDir + getFileName(f))
        fileItems.push({ local: f, remote: getCurrentDir() + getFileName(f) })
    });
    id = addInfo('upload', files, true)
    // setTimingProcess()
    // setProcess(20)
    getSSH().putFiles(fileItems).then(function () {
        // console.log("The File thing is done")
        doProcess(id)
        // addInfo('success')
        ls('')
    }, function (error) {
        // console.log("Something's wrong", error)
        doProcess(id, 'failed', error)
    }).catch((res) => {
        doProcess(id, 'failed', res)
    })
}

function upload() {
    showOpenFilesWin((ok, files) => {
        if (ok) {
            upload_file(files)
        }
    })
}

function getFolderName(path, withTail = true) {
    paths = path.split('/')
    tail = '/'
    if (!withTail) {
        tail = ''
    }
    return paths[paths.length - 2] + tail
}

function upload_folder() {
    showOpenFolderWin((ok, folder) => {
        if (!ok) {
            return
        }
        toFolder = getCurrentDir() + getFolderName(folder)
        // console.log(folder, 'to', toFolder)
        id = addInfo('upload', folder)
        // return
        getSSH().putDirectory(folder, toFolder, {
            recursive: true,
            concurrency: 10,
            validate: function (itemPath) {
                const baseName = path.basename(itemPath)
                return baseName.substr(0, 1) !== '.' && // do not allow dot files
                    baseName !== 'node_modules' // do not allow node_modules
            },
            tick: function (localPath, remotePath, error) {
                if (error) {
                    // console.log(localPath, error)
                } else {
                    // console.log('ok')
                }
            }
        }).then(function (status) {
            // addInfo('success')
            doProcess(id)
            ls("")//刷新列表
            finishProcess()
        }).catch((res) => {
            doProcess(id, 'failed', res)
        })
    })
}

function download_file(file) {
    showOpenFolderWin((ok, folder) => {
        if (!ok) {
            return
        }
        id = addInfo('download', file)
        getSSH().getFile(folder + file, getCurrentDir() + file).then(function (Contents) {
            // console.log("The File", file, "successfully downloaded")
            // addInfo('success')
            doProcess(id)
        }, function (error) {
            // console.log("Something's wrong")
            console.log(error)
        }).catch((res) => {
            doProcess(id, 'failed', res)
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
        tag = '-drf'
    }
    id = addInfo('rm', file)
    getSSH().exec('rm', [tag, getCurrentDir() + file]).then(() => {
        doProcess(id)
        ls("")
    }).catch((res) => {
        // console.log("exception", res)
        doProcess(id, 'failed', res)
    })
}

function getFileFullName(file, tail) {
    return file.replace(tail, '')
}

function getFileParentName(file) {
    if (file == "") {
        return ""
    }
    var obj = file.lastIndexOf(".");
    return file.slice(0, obj);//文件名
}

function getFileType(file) {
    if (file == "") {
        return ""
    }
    var obj = file.lastIndexOf(".");
    return file.slice(obj + 1);//文件名
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
    getFileList().forEach((file) => {
        if (file.name == filename && file.isDir == isDir) {
            isRename = true
        }
    })
    return isRename
}

function mkdir(dir_name = document.getElementById('dir_name').value) {
    if (!dir_name || dir_name == "") {
        show_dialog(false)
        return
    }
    //检查重名
    if (checkRename(dir_name, true)) {
        alert('文件名重复')
        return
    }
    id = addInfo('mkdir', dir_name)
    //mkdir by ssh
    getSSH().mkdir(getCurrentDir() + dir_name).then(function () {
        // console.log("mkdir success", dir_name)
        doProcess(id)
        // ls(dir_name) //进入该文件夹
        ls("")//只刷新目录
    }, function (error) {
        // console.log(error)
        doProcess(id, 'failed', error)
    })
    show_dialog(false)
}

function to_login() {
    ipcRenderer.send('new_win')
    // ****old*****
    // if (!confirm("确定断开连接,并返回主页？")) {
    //     return
    // }
    // getSSH().dispose()
    // // document.body.innerHTML = ""
    // window.location.href = 'login.html'
}

function connectSSH() {
    var ssh = new node_ssh()
    //
    userSSHInfo = getUserSSHInfo()
    id = addInfo('connect', '{0}@{1}:{2}'.format(userSSHInfo.username, userSSHInfo.host, userSSHInfo.port))
    ssh.connect({
        host: userSSHInfo.host,
        username: userSSHInfo.username,
        password: userSSHInfo.password,
        privateKey: userSSHInfo.privateKey,
        port: userSSHInfo.port,
    }).then(() => {
        setSSH(ssh)
        // console.log("connect success!")
        doProcess(id)
        ls("")
    }, function (error) {
        // console.log("connect failed!", error)
        doProcess(id, 'failed', error)
    })
}

function setTitle() {
    userSSHInfo = getUserSSHInfo()
    document.getElementById('head-title').innerHTML = userSSHInfo.label
}

function clean_infos() {
    if (getLock() == 0) {
        document.getElementById('infos').innerHTML = ''
        resetInfos_count()
    }
}

function saveUserSSHInfo(userSSHInfo) {
    readConf((ok, conf) => {
        if (ok) {
            //update favourites
            conf[getUserSSHInfo().id] = userSSHInfo
            //write to local
            writeConf(conf, (err) => {
                if (err) {
                    console.log(err)
                }
            })
        }
    })
}

function favourite_folder(folder, current = getCurrentDir()) {
    favourites = getUserSSHInfo().favourites
    //检查重复
    isHave = false
    favourites.forEach((fav) => {
        if (fav.currentDir == current && folder == fav.folder) {
            isHave = true
            return
        }
    })
    if (isHave) {
        // console.log('already has')
        alert('已被收藏!')
        showfavouritesMenu(false)
        return
    }
    new_favourite = { currentDir: current, folder: folder }
    favourites.push(new_favourite)
    getUserSSHInfo().favourites = favourites
    // console.log(userSSHInfo)
    saveUserSSHInfo(userSSHInfo)
    //hide it
    showfavouritesMenu(false)
}

/** collection* */
var isfavouritesMenuShow = true

function setfavouritesMenu() {
    // console.log(getUserSSHInfo().favourites)
    setHTMLByID('favourites', '<button onclick="favourite_folder(\'{0}\',\'{1}\')">♥ this</button>'.format(getFolderName(getCurrentDir(), false), getParentPath(getCurrentDir())))
    getUserSSHInfo().favourites.forEach((fav, i) => {
        appenHTMLByID('favourites', '\n<hr><button onclick="goFavourite({0})" oncontextmenu="showFavouriteMenu({0})">{1}{2}</button>'.format(i, fav.currentDir, fav.folder))
    })
}

function goFavourite(id) {
    fav = getUserSSHInfo().favourites[id]
    setCurrentDir(fav.currentDir)
    ls(fav.folder)
    showfavouritesMenu()
}

function del_favourite(id) {
    favourites = getUserSSHInfo().favourites
    favourites.splice(id, 1)
    getUserSSHInfo().favourites = favourites
    //save
    saveUserSSHInfo(userSSHInfo)
    //refresh
    showfavouritesMenu(true)
}

function showfavouritesMenu(isShow = isfavouritesMenuShow) {
    //set menu
    setfavouritesMenu()
    //show menu
    favouritesMenu = document.getElementById('favouritesMenu')
    favouritesMenu.style.display = isShow ? 'block' : 'none'
    isfavouritesMenuShow = !isShow
}

function showHiddenFile() {
    isShowHidden = !getIsShowHidden()
    setIsShowHidden(isShowHidden)
    ls('', isShowHidden)
}

function zip_folder(folder) {
    currentDir = getCurrentDir()
    id = addInfo('zip', folder)
    getSSH().exec('zip', ['-r', folder + '.zip', folder], {
        cwd: currentDir,
        onStdout(chunk) {
            read_line(chunk, getUserSSHInfo().characterSet, (line, i) => {
                doProcess(id, 'info', line)
            })
        }, onStderr(chunk) {
            // console.log('stderrChunk', chunk.toString(getUserSSHInfo().characterSet))
        }
    }).then(() => {
        // addInfo('success')
        doProcess(id)
        ls('')
    }).catch((res) => {
        // console.log("exception", res)
        doProcess(id, 'failed', res)
    })
}

// 将压缩文件test.zip在指定目录/tmp下解压缩，如果已有相同的文件存在，要求unzip命令覆盖原先的文件。

// unzip -o test.zip -d tmp/
function unzip_file(file) {
    var args = []
    var cmd = ''
    var currentDir = getCurrentDir()
    if (file.endsWith('.zip')) {
        cmd = 'unzip'
        args = ['-o', currentDir + file, '-d', currentDir]
    } else if (file.endsWith('.tar.gz')) {
        cmd = 'tar'
        args = ['-zxvf', currentDir + file, '-C', currentDir]
    } else if (file.endsWith('.tar.xz')) {
        cmd = 'tar'
        args = ['-xvf', currentDir + file, '-C', currentDir]
    } else {
        return
    }
    id = addInfo(cmd, file)
    getSSH().exec(cmd, args, {
        onStdout(chunk) {
            read_line(chunk, getUserSSHInfo().characterSet, (line, i) => {
                doProcess(id, 'info', line)
            })
        }, onStderr(chunk) {
            // console.log('stderrChunk', chunk.toString(getUserSSHInfo().characterSet))
        }
    }).then(() => {
        // addInfo('success')
        doProcess(id)
        ls('')
    }).catch((res) => {
        // console.log("exception", res)
        doProcess(id, 'failed', res)
    })
}

function ctrl_c() {
    console.log('ctrl+c')
    getSSH().exec('ctrl+c', [], {
        onStdout(chunk) {
            console.log('stdoutChunk', chunk.toString(getUserSSHInfo().characterSet))
        }, onStderr(chunk) {
            console.log('stderrChunk', chunk.toString(getUserSSHInfo().characterSet))
        }
    }).catch((res) => {
        console.log("exception", res)
    })
}

function exec(cmd = '', args = [], msg, f_ok, f_error) {

}

var copy_from = ""

function copy(from = copy_from, to = "") {
    if (from && from != "") {
        var id = addInfo('copy from', from)
        copy_from = getCurrentDir() + from
        doProcess(id)
    }
    if (to && to != "" && copy_from != "") {
        var id = addInfo('copy to', to)
        getSSH().exec('cp', ['-r', copy_from, to]).then(() => {
            doProcess(id)
            copy_from = ""
            ls()
        }).catch((res) => {
            doProcess(id, 'failed', res)
        })
    }
}

ipcRenderer.on('add_ssh', (event, userSSHInfo) => {
    // console.log("add ssh", userSSHInfo)
    new_ssh(userSSHInfo, getHome(userSSHInfo.username))
})

function new_ssh(userSSHInfo, currentDir) {
    // console.log(userSSHInfo.label)
    ssh_list.push({
        userSSHInfo: userSSHInfo,
        currentDir: currentDir,
        ssh: null,
        fileList: [],
        isShowHidden: false,
        infos_count: 0,
        ls_history: [],
        backIndex: 0,
        ls_lock: false,
    })
    //最后一个是最新
    ssh_index = ssh_list.length - 1
    //设置窗口标题
    setTitle()
    //设置激活
    // setTabActive(ssh_index)
    setTabs()
    //加载list
    connectSSH()
}

function setTabActive(id) {
    var tabs = document.getElementById('tab-bar').children;
    // console.log(tabs.length, id)
    for (i = 0; i < tabs.length; i++) {
        if (i == id) {
            tabs[i].classList.add('tab-active')
        } else {
            tabs[i].classList.remove('tab-active')
        }
    }
}

function setTabs() {
    document.getElementById('tab-bar').innerHTML = ''
    ssh_list.forEach((ssh, i) => {
        if (i == ssh_index) {
            active_css = 'class="tab-active"'
        } else {
            active_css = ''
        }
        document.getElementById('tab-bar').innerHTML += `<div ${active_css} id="tab-${i}" oncontextmenu="showTabMenu(${i})" onclick="to_ssh(${i})">${ssh.userSSHInfo.label}</div>`
    })

}

function closeTab(id) {
    var i = addInfo('close', getUserSSHInfo(id).label)
    getSSH(id).dispose()
    ssh_list.splice(id, 1)
    to_ssh(id - 1 > 0 ? id - 1 : 0, true)
    doProcess(i)
}

function to_ssh(index, isNew = false) {
    if (ssh_list.length == 0) {
        document.location.href = 'login.html'
    }
    if (index == ssh_index && !isNew) {
        return
    }
    console.log("to ssh", index)
    ssh_index = index
    var i = addInfo('to', `[${getUserSSHInfo().label}]`)
    // setTabActive(index)
    setTabs()
    ls()
    doProcess(i)
}

//设置主题
setTheme()
//on init win
new_ssh(remote.getGlobal('shareData').userSSHInfo, getHome(remote.getGlobal('shareData').userSSHInfo.username))
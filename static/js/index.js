var remote = require('electron').remote;
var process = require('child_process');
var os = require('os');
const node_ssh = require('node-ssh')
const path = require("path");

// const readline = require('readline');
// ---------------data-start--------------
let ssh_list = []

const LS_HISTORY_MAX = 100

const MAX_INFOS_NUM = 100

const MAX_LIST_NUM = 1000

let current_ssh_id = -1

let bs_list = []

const LOADING_HTML = '<img class="img-loading" src="static/img/loading.gif">'

const UP_FILE_NAME = '../'

const BACK_FILE_NAME = '-1'

const HOME_FILE_NAME = '$HOME'

function getCurrentDir() {
    return ssh_list[current_ssh_id].currentDir
}

function setCurrentDir(dir) {
    ssh_list[current_ssh_id].currentDir = dir
}

function getUserSSHInfo(id = current_ssh_id) {
    return ssh_list[id].userSSHInfo
}

function setUserSSHInfo(userSSHInfo) {
    ssh_list[current_ssh_id].userSSHInfo = userSSHInfo
}

function getSSH(id = current_ssh_id) {
    return ssh_list[id].ssh
}

function setSSH(id, ssh) {
    ssh_list[id].ssh = ssh
}

function put_ls_history(current, dir) {
    ssh_list[current_ssh_id].ls_history.push({ currentDir: current, dir: dir })
}

function get_ls_history() {
    return ssh_list[current_ssh_id].ls_history
}

function setIsShowHidden(isShow) {
    ssh_list[current_ssh_id].isShowHidden = isShow
}

function getIsShowHidden() {
    return ssh_list[current_ssh_id].isShowHidden
}

function plusInfos_count(n) {
    ssh_list[current_ssh_id].infos_count += n
}

function resetInfos_count() {
    ssh_list[current_ssh_id].infos_count = 0
}

function getInfos_count() {
    let ssh = ssh_list[current_ssh_id]
    if (ssh) {
        return ssh.infos_count
    }
    return 0
}

function resetFileList() {
    ssh_list[current_ssh_id].fileList = []
}

function getFileList() {
    return ssh_list[current_ssh_id].fileList
}

function setBackIndex(id) {
    return ssh_list[current_ssh_id].backIndex = id
}

function getBackIndex() {
    return ssh_list[current_ssh_id].backIndex
}

function get_ls_lock() {
    return ssh_list[current_ssh_id].ls_lock
}

function set_ls_lock(lock) {
    ssh_list[current_ssh_id].ls_lock = lock
}

function get_copy_from() {
    return ssh_list[current_ssh_id].copy_from
}

function set_copy_from(from) {
    ssh_list[current_ssh_id].copy_from = from
}
// ---------------data-end--------------


function getHome(username, osType = 'Linux') {
    // console.log('get home', username, `"${osType}"`)
    let home = `/home/${username}/`
    if (osType == 'Darwin') {
        home = `/Users/${username}/`
    } else if (osType == 'WindowsNT') {
        home = `/C/Users/${username}/`
    } else if (osType == 'Linux' && username == 'root') {
        home = `/root/` //linux下root用户的目录是/root
    }
    return home
}

function addLock(isLock = false) {
    ipcRenderer.send('set_lock', isLock)
}

function done_process(id, tg = 'success', msg = '') {
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
    if (getInfos_count() > MAX_INFOS_NUM) {
        clean_infos()
    }
}

function open_file(id, file) {
    console.log('open', id, file)
    if (get_bs(id)) {
        console.log('open error: is downloading')
        return false //还在下载中
    }
    process.exec(`open "${file}"`, function(error, stdout, stderr) {
        console.log("open error:" + error, "stdout:" + stdout, "stderr:" + stderr);
        if (stderr) {
            alert(stderr)
        }
    });
}

function addError(msg) {
    document.getElementById('infos').insertAdjacentHTML("beforeend", `<div class="line-div"><p class="txt-danger">${msg}</p></div>`)
}

function addInfo(msg, file = '', isArray = false, path = '') {
    //get file
    if (isArray) {
        file = file.join(',<br>')
    }
    //sha1 a id
    let loading_html = LOADING_HTML
    let id = new Date().getTime()
    if (msg == 'download') {
        file = `<a onclick="open_file('${id}','${path+file}')" class="link">${file}</a>` //下载完成打开的连接
    }
    document.getElementById('infos').insertAdjacentHTML("beforeend", `<div class="line-div" id="line_${id}"><p id="${'info_'+id}"><label>${msg}</label>${file}</p><p id="${id}">${loading_html}</p></div>`)
    sidebar = document.getElementById('sidebar') //滑动到底部
    sidebar.scrollTop = sidebar.scrollHeight;
    addLock(true) //加锁，退出提示，禁止清空

    plusInfos_count(1) //infos_count++
    return id
}

let showPath = (path) => {
    // console.log('path', path.split('/'))
    document.querySelector('#path').innerHTML = path
}

function show_ssh_alert(color, msg = '正在连接...') {
    if (color == 'danger') {
        msg = '连接失败! 请检查网络或ssh配置'
    }
    document.querySelector('#file_list').innerHTML = `<tr class="no-hover"><td class="td-alert txt-${color}">${msg}</td></tr>`
}

function ls_up() {
    ls(UP_FILE_NAME)
}

function ls_back() {
    ls(BACK_FILE_NAME)
}

function ls_home() {
    ls(HOME_FILE_NAME)
}

function ls(dir, isShowHidden = getIsShowHidden()) {
    let ssh_client = getSSH()
    if (get_ls_lock()) {
        // console.log('ls locked')
        return
    }
    if (ssh_client == null) { //ssh正在连接
        showPath('')
        show_ssh_alert('warning')
        return
    }
    if (ssh_client == -1) { //ssh连接失败
        showPath('')
        show_ssh_alert('danger')
        return
    }
    //dir = "" 刷新
    // show_ssh_alert('info', `ls ${dir}`) //显示正在进行的操作
    // >>>>>>>>>>list缓存-start
    if (dir == null && ssh_list[current_ssh_id].fileList.length > 0) {
        showPath(getCurrentDir())
        ssh_list[current_ssh_id].fileList.forEach((fileInfo, i) => {
            document.querySelector('#file_list').insertAdjacentHTML('beforeend', getFileHTML(fileInfo))
        })
        return
    }
    // >>>>>>>>>>list缓存-end
    resetFileList()
    backIndex = getBackIndex()
    ls_history = get_ls_history()
    currentDir = getCurrentDir()
    if (dir) {
        if (dir == UP_FILE_NAME) {
            setCurrentDir(getParentPath(currentDir))
        } else if (dir == HOME_FILE_NAME) {
            setCurrentDir(getHome(getUserSSHInfo().username, getUserSSHInfo().osType))
        } else if (dir == BACK_FILE_NAME) {
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
    showPath(`${getCurrentDir()} <img src="static/img/loading.gif">`) //path栏显示进度，*细节设计
    setBackIndex(backIndex)
    put_ls_history(getCurrentDir(), dir)
        // console.log('add history', currentDir, ls_history.length)

    //setlock
    set_ls_lock(true)

    //get parent path
    // parentPath = getParentPath(getCurrentDir())
    // console.log('ls', currentDir)
    // let id = addInfo('ls', getCurrentDir()) //不显示ls记录，ls太多了

    let arg = '-l' //arg
    let n = -1 //计数
    if (isShowHidden) {
        arg = '-la'
        n = -3 //省略.,..,index从-3开始

        // 改变tool-bar按钮css
        document.getElementById('btn-show-hidden').classList.add('txt-info')
    } else {
        document.getElementById('btn-show-hidden').classList.remove('txt-info')
    }
    let once = 0

    //>>>>> 添加../向上目录-start
    document.querySelector('#file_list').innerHTML = "" //清空列表

    if (getCurrentDir() != "/") { //添加上级目录标识
        //add up
        up_file = init_fileInfo()
        up_file.name = UP_FILE_NAME
        up_file.isDir = true
        up_file.time = ''
        set_file_info_html(up_file)
        first = false
    }
    //>>>>> 添加../向上目录-end

    ssh_client.exec('ls', [arg, getCurrentDir()], {
        onStdout(chunk) {
            if (n > MAX_LIST_NUM) {
                if (once < 1) {
                    once++
                    document.querySelector('#file_list').insertAdjacentHTML("beforeend", `<tr><td colspan="5" class="txt-center">快不行了...只能显示前${n}行</td></tr>`)
                }
                return false
            }
            //parse line
            read_line(chunk, getUserSSHInfo().characterSet, (line) => {
                n++
                if (isShowHidden && n <= 0) { // 不添加 【表头,.(本目录),..(上级目录)】
                    return
                }
                parse_ls_line(line, n)
            })
        },
        onStderr(chunk) {
            let err = chunk.toString(getUserSSHInfo().characterSet)
            showPath(`<span class="txt-danger">${err}</span>`) //*细节，在path栏直接显示错误比较直观
            console.log('stderrChunk', err)
        }
    }).then(() => {
        //0.set path
        showPath(getCurrentDir())

        // addInfo('success')
        // done_process(id) //不显示ls记录
        set_ls_lock(false)
    }).catch((res) => {
        if (res) {
            res = res.toString()
        }
        // console.log("exception", res)
        // done_process(id, 'failed', res) //不显示ls记录
        showPath(`<span class="txt-danger">${res}</span>`) //*细节，在path栏直接显示错误比较直观
            // addError(res) //提示错误
        set_ls_lock(false)
        setCurrentDir(currentDir) //还原原路径

        // set connect_closed
        if (res.indexOf('No response from server') != -1 || res.indexOf('ERR_ASSERTION') != -1) {
            console.log('No response from server')
        }
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
    set_file_info(attrs, id)
}

let init_fileInfo = () => {
    return {
        rights: "",
        fileCount: 0,
        type: "file",
        user: "",
        group: "",
        size: 0,
        formatSize: '',
        month: "",
        day: "",
        year: "",
        name: "",
        isDir: true,
        id: 0
    }
}

let set_file_info = (attrs = [], id) => {
    if (attrs.length < 9) {
        return
    }

    let fileInfo = init_fileInfo()

    fileInfo.rights = attrs[0]
    fileInfo.isDir = fileInfo.rights.startsWith('d')
    fileInfo.fileCount = parseInt(attrs[1])
    fileInfo.user = attrs[2]
    fileInfo.group = attrs[3]
    fileInfo.size = parseInt(attrs[4])
    fileInfo.formatSize = formatSize(fileInfo.size)
    fileInfo.month = attrs[5]
    fileInfo.day = attrs[6]
    fileInfo.hour = attrs[7]
    fileInfo.name = attrs.slice(8).join(' ')
    fileInfo.time = ` ${fileInfo.hour} ${fileInfo.month}${fileInfo.day}`
    fileInfo.type = getFileType(fileInfo.name, fileInfo.isDir)
    fileInfo.id = id

    set_file_info_html(fileInfo)
}

function getFileHTML(fileInfo) {
    //set font color
    font_class = ""
    if (fileInfo.name.startsWith('.')) {
        font_class = 'font-light'
    }
    if (fileInfo.isDir) { //目录
        tr_html = `<tr oncontextmenu="showFolderMenu(${fileInfo.id})">`
        if (fileInfo.name == UP_FILE_NAME) {
            tr_html = '<tr>'
        }
        //<td class="td-num">${fileInfo.id}</td> //不显示行号了，显示的要素太臃肿了
        return `${tr_html}<td class="td-icon"><img class="icon" src="static/img/svg/doctype/icon-${fileInfo.type}-m.svg"></td><td class="td-head"><a onclick="ls('${fileInfo.name}')" href="#" class="hover-link"><div class="${font_class}">${fileInfo.name}</div></a></td><td>${fileInfo.time}</td><td colspan="2"></td></div>`
    } else { //文件
        var watch_link = ''
        if (fileInfo.type == 'video' || fileInfo.type == 'flv') { //视频文件（暂时找不到好的远程播放的方法，本地缓存不能流媒体播放）
            // watch_link = `<a onclick="watch_video('${fileInfo.name}')" href="#">▶</a>`
        }
        return `<tr oncontextmenu="showFileMenu(${fileInfo.id})" id="f-${fileInfo.id}"><td class="td-icon"><img class="icon" src="static/img/svg/doctype/icon-${fileInfo.type}-m.svg"></td><td class="td-head"><div class="${font_class}">${fileInfo.name}</div></td><td>${fileInfo.time}</td><td>${fileInfo.formatSize}</td><td class="td-download">${watch_link} <a href="#" onclick="download_file('${fileInfo.name}',${fileInfo.size})">⇩</a></div>`
    }
}

function set_file_info_html(fileInfo) {
    //push to list
    ssh_list[current_ssh_id].fileList.push(fileInfo)

    //set html
    document.querySelector('#file_list').insertAdjacentHTML('beforeend', getFileHTML(fileInfo))
}

function getParentPath(file) {
    if (file == "" || file == "/") {
        return file
    }
    let i = file.lastIndexOf("/");
    if (i == file.length - 1) {
        file = file.slice(0, file.length - 2)
    }
    i = file.lastIndexOf("/");
    // return file.substr(obj+1);//文件名
    return file.substr(0, i + 1) //路径
}

function watch_video(file) {
    let folder = `${getHome(getUserSSHInfo().username, os.type)}.eftp/`
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder)
    }
    let id = addInfo('video', file)
    let tmp = folder + file
    show('video_dialog', true)
    if (fs.existsSync(tmp)) { //视频文件已经下载
        done_process(id) //停止log进度条
        document.getElementById('video').setAttribute('src', `file://${tmp}`) //直接播放
        console.log('video', tmp)
        return
    }
    setTimeout(() => { //2秒后开始播放
        console.log('video', tmp)
        document.getElementById('video').setAttribute('src', `file://${tmp}`)
    }, 2000)
    getSSH().getFile(tmp, getCurrentDir() + file).then(function(Contents) { //下载视频文件
        // console.log("The File", file, "successfully downloaded")
        // addInfo('success')
        //下载成功的操作
        done_process(id) //停止log进度条
            // remove_bs(id) //删除后台任务
            // done_watch(watch_id) //关闭进度监听
    }, function(error) { //下载失败
        console.log(error)
        done_process(id, 'failed', error)
            // done_watch(watch_id) //关闭监听
    }).catch((res) => { //下载异常
        console.log(res)
        done_process(id, 'failed', res)
            // done_watch(watch_id) //关闭监听
    })
}

function upload_file(files) {
    let fileItems = []
    let currentDir = getCurrentDir()
    let remotes = []
    files.forEach(f => {
        // console.log(currentDir + getFileName(f))
        let f_name = currentDir + getFileName(f)
        fileItems.push({ local: f, remote: f_name })
        remotes.push(f_name)
    });
    let id = addInfo('upload', files, true)
    push_bs(id, files.join(','), '↑')
        // setTimingProcess()
        // setProcess(20)
    let watch_id = watch_upload_file(id, files, remotes)
    getSSH().putFiles(fileItems).then(function() {
        // console.log("The File thing is done")
        done_watch(watch_id)
        done_process(id)
        remove_bs(id)
            // addInfo('success')
        ls('')
    }, function(error) {
        done_watch(watch_id)
            // console.log("Something's wrong", error)
        done_process(id, 'failed', error)
    }).catch((res) => {
        done_watch(watch_id)
        done_process(id, 'failed', res)
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
        let toFolder = getCurrentDir() + getFolderName(folder)
            // console.log(folder, 'to', toFolder)
        let id = addInfo('upload', folder)
        push_bs(id, folder, '↑')
            // return
        getSSH().putDirectory(folder, toFolder, {
            recursive: true,
            concurrency: 10,
            validate: function(itemPath) {
                const baseName = path.basename(itemPath)
                return baseName.substr(0, 1) !== '.' && // do not allow dot files
                    baseName !== 'node_modules' // do not allow node_modules
            },
            tick: function(localPath, remotePath, error) {
                if (error) {
                    // console.log(localPath, error)
                } else {
                    // console.log('ok')
                }
            }
        }).then(function(status) {
            // addInfo('success')
            done_process(id)
            remove_bs(id)
            ls("") //刷新列表
        }).catch((res) => {
            done_process(id, 'failed', res)
        })
    })
}

function push_bs(id, file, status) {
    bs_list.push({ id: id, file: file, status: status })
    addClassByID('btn_bs', 'txt-info')
}

function remove_bs(id) {
    bs_list.forEach((item, i) => {
        if (item.id == id) {
            bs_list.splice(i, 1)
        }
    })
    if (bs_list.length < 1) {
        delClassByID('btn_bs', 'txt-info')
    }
}

function get_bs(id) {
    let bs = null
    bs_list.forEach((item, i) => {
        console.log(item.id)
        if (item.id == id) {
            bs = item
        }
    })
    return bs
}

function watch_download_file(id, file, f_size) {
    return self.setInterval(() => {
        // console.log(stats.size, `${percentage}%`);
        set_file_status_info(id, fs.statSync(file).size, f_size)
            // console.log('watch', file)
    }, 250); // 250毫秒，由于是本地调用，时间间隔可以短
}

function set_file_status_info(id, size, f_size) {
    let percentage = Math.ceil(size / f_size * 100)
    if (size == f_size) //到100%，自动删除进度
        done_process(id)
    else
        set_html(id, `<img class="img-loading" src="static/img/loading-4.gif"><span> ${formatSize(size) +'/'+formatSize(f_size)} <span class="txt-info">${percentage}% </span><a onclick="" class="txt-danger">取消</a></span>`)
}

function watch_upload_file(id, files, remotes) {
    let total = 0
    files.forEach((f) => { // 1. 获取本地上传文件[总大小]
        total += fs.statSync(f).size
    })
    let arg = '--format=%s'
    if (getUserSSHInfo().osType == 'Darwin') {
        arg = '-f %z'
    }
    return self.setInterval(() => {
        let size_sum = 0
        remotes.forEach((remote) => { //按顺序计算上传文件的大小
            getSSH().exec('stat', [arg, remote], {
                onStdout(chunk) {
                    let size = parseInt(chunk.toString(getUserSSHInfo().characterSet))
                    size_sum += size
                    set_file_status_info(id, size_sum, total)
                },
                onStderr(chunk) {
                    console.log('stat', chunk.toString(getUserSSHInfo().characterSet))
                }
            }).catch((res) => {
                // console.log('stat', res) //这里上传时可能出现许多次异常（上传导致的网络拥塞），可以忽略
            })
        })
    }, 500); //500毫秒
}

function done_watch(id) {
    window.clearInterval(id)
    console.log('done watch:', id)
}

function rm_file(file, id) {
    console.log('rm local', file)
    if (fs.existsSync(file)) {
        try {
            fs.unlinkSync(file) //删除本地文件
        } catch (err) { //删除失败，警告
            alert(err)
        }
    }
    document.getElementById(`line_${id}`).remove()
}

function download_file(file, f_size) {
    showOpenFolderWin((ok, folder) => {
        if (!ok) {
            return
        }
        let currentDir = getCurrentDir()
        let id = addInfo('download', file, false, folder) //添加log
        push_bs(id, file, '↓') //添加到后台任务列表
        let watch_id = watch_download_file(id, folder + file, f_size) //开始监控下载进度
        getSSH().getFile(folder + file, currentDir + file).then(function(Contents) {
            // console.log("The File", file, "successfully downloaded")
            // addInfo('success')
            //下载成功的操作
            done_process(id) //停止log进度条
            remove_bs(id) //删除后台任务
            done_watch(watch_id) //关闭进度监听
            appendHTMLByID(`info_${id}`, ` <a onclick="rm_file('${folder + file}',${id})" class="txt-danger"> 删除</a>`) //显示删除
        }, function(error) { //下载失败
            // console.log(error)
            done_process(id, 'failed', error)
            done_watch(watch_id) //关闭监听
        }).catch((res) => { //下载异常
            done_process(id, 'failed', res)
            done_watch(watch_id) //关闭监听
        })
    })
}

const K = 1024

function formatSize(size) { //时间复杂度 O(1)
    let i = 0
    let unit = ''
    if (size < K) {
        unit = 'B'
    } else if (size < K * K) {
        size = parseInt(size / K)
        unit = 'K'
    } else if (size < K * K * K) {
        size = parseInt(size / K / K)
        unit = 'M'
    } else if (size < K * K * K * K) {
        size = (size / K / K / K).toFixed(1) //保留一位小数
        unit = 'G'
    }
    return `${size}${unit}`
}

function del_file(file, isDir) {
    let f_tag = isDir ? "文件夹" : "文件"
    if (!confirm(`确定删除-${f_tag}-[${file}] ?`)) {
        return
    }
    let tag = '-f'
    if (isDir) {
        tag = '-rf'
    }
    let id = addInfo('rm', file)
    getSSH().exec('rm', [tag, getCurrentDir() + file]).then(() => {
        done_process(id)
        ls("")
    }).catch((res) => {
        // console.log("exception", res)
        done_process(id, 'failed', res)
    })
}

function getFileFullName(file, tail) {
    return file.replace(tail, '')
}

function getFileParentName(file) {
    if (file == "") {
        return ""
    }
    let obj = file.lastIndexOf(".");
    return file.slice(0, obj); //文件名
}

function getFileType(file, is_folder = false) {
    if (is_folder) {
        return "file" //目录
    }
    let obj = file.lastIndexOf(".");
    let file_type = "nor"
    if (obj < 0) {
        return file_type
    }
    let extension = file.slice(obj + 1); //文件后缀

    // console.log('get file type', file, 'extension:', extension)
    switch (extension) {
        case 'doc':
        case 'docx':
            file_type = 'doc'
            break
        case 'ppt':
        case 'pptx':
            file_type = 'ppt'
            break
        case 'xls':
        case 'xlsx':
            file_type = 'xls'
            break
        case 'pdf':
            file_type = 'pdf'
            break
        case 'apk':
            file_type = 'apk'
            break
        case 'dmg':
            file_type = 'ipa'
            break
        case 'psd':
            file_type = 'ps'
            break
        case 'html':
        case 'htm':
        case 'url':
            file_type = 'shared-link'
            break
        case 'txt':
        case 'md':
        case 'json':
        case 'yml':
        case 'conf':
        case 'sh':
        case 'sql':
            file_type = 'txt'
            break
        case 'mp4':
        case 'rmvb':
        case 'mkv':
        case 'avi':
            file_type = 'video'
            break
        case 'flv':
            file_type = 'flv'
            break
        case 'bt':
        case 'torrent':
            file_type = 'bt'
            break
        case 'mp3':
        case 'm4a':
        case 'flac':
        case 'wma':
            file_type = 'audio'
            break
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'bmp':
        case 'gif':
        case 'svg':
            file_type = 'pic'
            break
        case 'zip':
        case '7z':
        case 'gz':
        case 'rar':
        case 'tar':
        case 'xz':
            file_type = 'zip'
            break
        case 'c':
        case 'cpp':
        case 'go':
        case 'java':
        case 'py':
        case 'ipynb':
        case 'js':
        case 'css':
            file_type = 'code'
            break
    }
    return file_type
}

function getFileName(file) {
    if (file == "") {
        return ""
    }
    let obj = file.lastIndexOf("/");
    return file.substr(obj + 1); //文件名
}

function set_html(id, html) {
    document.getElementById(id).innerHTML = html
}

function show(id, isShow) {
    if (isShow) {
        document.getElementById(id).style.display = 'block'
    } else {
        document.getElementById(id).style.display = 'none'
    }
}

function show_folder_dialog(isShow) {
    show('new_folder_dialog', isShow)
    if (isShow) {
        document.getElementById('dir_name').focus() //文件名-输入框
    } else {
        document.getElementById('dir_name').value = ''
    }
}

function keydown_mkdir() {
    if (event.keyCode == 13) {
        mkdir()
    } else if (event.keyCode == 27) {
        show_folder_dialog(false)
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
        show_folder_dialog(false)
        return
    }
    //检查重名
    if (checkRename(dir_name, true)) {
        alert('文件名重复')
        return
    }
    let id = addInfo('mkdir', dir_name)
        //mkdir by ssh
    getSSH().mkdir(getCurrentDir() + dir_name).then(function() {
        // console.log("mkdir success", dir_name)
        done_process(id)
            // ls(dir_name) //进入该文件夹
        ls("") //只刷新目录
    }, function(error) {
        // console.log(error)
        done_process(id, 'failed', error)
    })
    show_folder_dialog(false)
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

var osTypeList = ['Linux', 'Darwin', 'WindowsNT']

function connectSSH(ssh_id = current_ssh_id) {
    let ssh = new node_ssh()
    let userSSHInfo = getUserSSHInfo()
    let id = addInfo('connect', `${userSSHInfo.username}@${userSSHInfo.host}:${userSSHInfo.port}`)
    show_ssh_alert('warning') //显示正在连接
    ssh.connect({
        host: userSSHInfo.host,
        username: userSSHInfo.username,
        password: userSSHInfo.password,
        privateKey: userSSHInfo.privateKey,
        port: userSSHInfo.port,
    }).then(() => {
        setSSH(ssh_id, ssh)
            // console.log("connect success!")
        setTabs(ssh_id) //1.修改tabs
        ssh.exec('uname', ['-s'], { // 2.获取home（兼容不同的系统）
            onStdout(chunk) {
                let os_type = chunk.toString(userSSHInfo.characterSet).replace(/\n|\r/g, "") //！！！！注意去掉换行符

                if (!osTypeList.includes(os_type)) { //暂时不支持windows系统
                    alert(`暂时不支持连接到${os_type}系统！`)
                    return false
                }
                //set os type
                userSSHInfo.osType = os_type
                setUserSSHInfo(userSSHInfo)

                saveUserSSHInfo(userSSHInfo) //2.保存新的UserSSHInfo
            },
            onStderr(chunk) {
                console.log('uname', chunk.toString(userSSHInfo.characterSet))
                addError(chunk.toString(userSSHInfo.characterSet))
            }
        }).then(() => { //uname 成功
            ls(HOME_FILE_NAME) //3.显示目录
            done_process(id) //4.结束log
        }).catch((res) => {
            console.log('uname', res)
        })
    }).catch((excp) => {
        setSSH(ssh_id, -1)
            // console.log("connect failed!", error)
        setTabs(ssh_id) //1.修改tabs
        if (ssh_id == current_ssh_id) { //2.如果还停留在当前页面，则修改提示
            show_ssh_alert('danger')
        }
        done_process(id, 'failed', excp) //3.
    })
}

function setTitle() {
    userSSHInfo = getUserSSHInfo()
    document.getElementById('head-title').innerHTML = userSSHInfo.label
}

function clean_infos() {
    document.getElementById('infos').innerHTML = ''
    resetInfos_count()
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
let isfavouritesMenuShow = true

function setfavouritesMenu() {
    // console.log(getUserSSHInfo().favourites)
    setHTMLByID('favourites', `<button onclick="favourite_folder('${getFolderName(getCurrentDir(), false)}','${getParentPath(getCurrentDir())}')">♥ 添加收藏</button>`)
    getUserSSHInfo().favourites.forEach((fav, i) => {
        appendHTMLByID('favourites', `\n<hr><button onclick="goFavourite(${i})" oncontextmenu="showFavouriteMenu(${i})">${fav.currentDir}${fav.folder}</button>`)
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
    let currentDir = getCurrentDir()
    let id = addInfo('zip', folder)
    getSSH().exec('zip', ['-r', folder + '.zip', folder], {
        cwd: currentDir,
        onStdout(chunk) {
            read_line(chunk, getUserSSHInfo().characterSet, (line, i) => {
                done_process(id, 'info', line)
            })
        },
        onStderr(chunk) {
            // console.log('stderrChunk', chunk.toString(getUserSSHInfo().characterSet))
        }
    }).then(() => {
        // addInfo('success')
        done_process(id)
        ls('')
    }).catch((res) => {
        // console.log("exception", res)
        done_process(id, 'failed', res)
    })
}

// 将压缩文件test.zip在指定目录/tmp下解压缩，如果已有相同的文件存在，要求unzip命令覆盖原先的文件。

// unzip -o test.zip -d tmp/
function unzip_file(file) {
    let args = []
    let cmd = ''
    let currentDir = getCurrentDir()
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
    let id = addInfo(cmd, file)
    getSSH().exec(cmd, args, {
        onStdout(chunk) {
            read_line(chunk, getUserSSHInfo().characterSet, (line, i) => {
                done_process(id, 'info', line)
            })
        },
        onStderr(chunk) {
            // console.log('stderrChunk', chunk.toString(getUserSSHInfo().characterSet))
        }
    }).then(() => {
        // addInfo('success')
        done_process(id)
        ls('')
    }).catch((res) => {
        // console.log("exception", res)
        done_process(id, 'failed', res)
    })
}

function show_space() {
    if (!check_ssh()) {
        return
    }
    console.log('df')
    getSSH().exec('df', ['-h'], {
        onStdout(chunk) {
            set_html('left_space', parse_df_line(chunk))
                // set_html('left_space', chunk.toString(getUserSSHInfo().characterSet))
            show('space_dialog', true)
        },
        onStderr(chunk) {
            set_html('left_space', chunk.toString(getUserSSHInfo().characterSet))
            show('space_dialog', true)
        }
    }).catch((res) => {
        // console.log("exception", res)
        set_html('left_space', res)
        show('space_dialog', true)
    })
}

function parse_df_line(chunk) {
    let html = ''
    let os_type = getUserSSHInfo().osType
    read_line(chunk, getUserSSHInfo().characterSet, (line, i) => {
        let line_items = line.trim().split(/\s+/) //根据空格拆分为数组
        if (line_items[0] == 'map' && os_type == 'Darwin') { //忽略mac下的干扰项 map auto_home...
            return
        }
        let tag_class = ''
        let left_percentage = line_items[4] // [0]Filesystem      [1]Size  [2]Used [3]Avail [4]Use%
        if (left_percentage == '100%') { //100% 没法比大小
            tag_class = 'txt-danger'
        } else if (left_percentage <= '30%') {
            tag_class = 'txt-success'
        } else if (left_percentage <= '50%') {
            tag_class = 'txt-info'
        } else if (left_percentage <= '70%') {
            tag_class = 'txt-warning'
        } else if (left_percentage <= '99%') {
            tag_class = 'txt-danger'
        }
        html += `<tr><td class="txt-left">${line_items[0]}</td><td class="txt-left">${line_items[1]}</td><td class="txt-left">${line_items[2]}</td><td class="txt-left">${line_items[3]}</td><td><span class="${tag_class}">${line_items[4]}</span></td></tr>\n`
    })
    return html
}

function check_ssh(ssh_id = current_ssh_id) {
    if (getSSH(ssh_id) && getSSH(ssh_id) != -1) {
        return true
    }
    return false
}

function ctrl_c(ssh_id = current_ssh_id) {
    if (!check_ssh(ssh_id)) {
        return
    }
    console.log('ctrl+c')
    getSSH(ssh_id).exec('ctrl+c', [], {
        onStdout(chunk) {
            console.log('stdoutChunk', chunk.toString(getUserSSHInfo().characterSet))
        },
        onStderr(chunk) {
            console.log('stderrChunk', chunk.toString(getUserSSHInfo().characterSet))
        }
    }).catch((res) => {
        console.log("exception", res)
    })
}

function exec(cmd = '', args = [], msg, f_ok, f_error) {

}

function copy(from = get_copy_from(), to = "", cmd = 'cp') {
    if (from && from != "") {
        let id = addInfo(`${cmd} from`, from)
        set_copy_from(getCurrentDir() + from)
        done_process(id)
    }
    if (to && to != "" && get_copy_from() != "") {
        let id = addInfo(`${cmd} to`, to)
        let args = []
        if (cmd == 'cp')
            args = ['-r', get_copy_from(), to]
        else if (cmd == 'mv')
            args = [get_copy_from(), to]

        //开始复制、粘贴
        getSSH().exec(cmd, args).then(() => {
            done_process(id)
            set_copy_from('')
            ls('')
        }).catch((res) => {
            done_process(id, 'failed', res)
        })
    }
}

ipcRenderer.on('add_ssh', (event, userSSHInfo) => {
    // console.log("add ssh", userSSHInfo)
    new_ssh(userSSHInfo) //进入个人主目录
})

function new_ssh(userSSHInfo) {
    // console.log(userSSHInfo.label)
    ssh_list.push({
        userSSHInfo: userSSHInfo,
        currentDir: '',
        ssh: null,
        fileList: [],
        isShowHidden: false,
        infos_count: 0,
        ls_history: [],
        backIndex: 0,
        ls_lock: false,
        copy_from: "",
    })

    current_ssh_id = ssh_list.length - 1 //最后一个是最新
    setTitle() //设置窗口标题
    showPath('') //清空path
    setTabs() //设置tab
    connectSSH(current_ssh_id) //加载list
}

function setTabActive(id) {
    let tabs = document.getElementById('tab-bar').children;
    // console.log(tabs.length, id)
    for (i = 0; i < tabs.length; i++) {
        if (i == id) {
            tabs[i].classList.add('tab-active')
        } else {
            tabs[i].classList.remove('tab-active')
        }
    }
}

function setTabs(ssh_id = current_ssh_id) {
    document.getElementById('tab-bar').innerHTML = ''
    ssh_list.forEach((ssh, i) => {
        if (i == current_ssh_id) {
            active_css = 'class="tab-active"'
        } else {
            active_css = ''
        }
        let tag = '◆' //◆,●,■,▲,▶
        let tag_class = 'txt-success'
        if (ssh.ssh == -1) {
            tag_class = 'txt-danger'
        } else if (ssh.ssh == null) {
            tag_class = 'txt-warning'
        }
        document.getElementById('tab-bar').insertAdjacentHTML("beforeend", `<div ${active_css} id="tab-${i}" oncontextmenu="showTabMenu(${i})" onclick="to_ssh(${i})"><span class="${tag_class}">${tag} </span>${ssh.userSSHInfo.label}</div>`)
    })

    // clean old ls
    if (ssh_id == current_ssh_id) {
        document.getElementById('file_list').innerHTML = ''
    }
}

function closeTab(id) {
    //检查是否能关闭
    let ssh_client = getSSH(id)
    if (ssh_client == null) { //=null 表示连接中，
        alert('还不能关闭，正在连接，请稍后！')
        return
    }

    //开始关闭
    let i = addInfo('close', getUserSSHInfo(id).label) //显示log到日志
    if (ssh_client && ssh_client != -1) { //=-1表示连接失败
        ssh_client.dispose()
    }
    ssh_list.splice(id, 1) //删除ssh info
    done_process(i) //先解close锁
    to_ssh(id - 1 > 0 ? id - 1 : 0, true) //跳转tab
}

function to_ssh(id, isNew = false) {
    if (ssh_list.length == 0) { //所有窗口都已经被关闭了
        document.location.href = 'login.html'
        return
    }
    if (id == current_ssh_id && !isNew) {
        return
    }
    console.log("to ssh", id)
    current_ssh_id = id

    // let i = addInfo('to', `[${getUserSSHInfo().label}]`) //细节，不显示log
    setTabs() //1.
    ls() //2.
        // done_process(i) //3.

}

function showSidebar() {
    let btn = document.getElementById('siderbar-hide-btn')
    showElement('sidebar', (isShow) => {
        if (!isShow) {
            document.documentElement.style.setProperty('--side-bar-r-w', '0px')
                // btn.classList.remove('show-btn')
                // btn.classList.add('hide-btn')
            btn.style.removeProperty('color')
        } else {
            document.documentElement.style.setProperty('--side-bar-r-w', '300px')
                // btn.classList.remove('hide-btn')
                // btn.classList.add('show-btn')
            btn.style.setProperty('color', 'var(--blue-2)')
        }
    })
}

function showElement(id, f = null) {
    let item = document.getElementById(id)
        // console.log(id, item.style.display)
    if (item.style.display == 'none') {
        if (f) {
            f(true)
        }
        item.style.display = 'block'
    } else {
        if (f) {
            f(false)
        }
        item.style.display = 'none'
    }
}

function show_backstageMenu(show) {
    showElement('backstageMenu', (isShow) => {
        if (isShow) {
            setBsMenu()
            console.log('show menu')
        }
    })
}

function setBsMenu() {
    document.getElementById('bs_list').innerHTML = ''
    if (bs_list.length > 0) {
        // bs_list
        bs_list.forEach((item, i) => {
            if (i == 0) {
                appendHTMLByID('bs_list', `\n<button >${item.status} ${item.file}</button>`)
            } else {
                appendHTMLByID('bs_list', `\n<hr><button >${item.status} ${item.file}</button>`)
            }

        })
    } else {
        appendHTMLByID('bs_list', `\n<button >空</button>`)
    }

}

function hideMenu() {
    document.getElementById('backstageMenu').style.display = 'none'
    document.getElementById('favouritesMenu').style.display = 'none'
    isfavouritesMenuShow = true
}

function refresh() {
    if (getSSH() == -1) {
        setSSH(current_ssh_id, null) //初始化
        setTabs() //刷新tabs
        connectSSH() //重新连接
    } else if (getSSH()) {
        ls('')
    }
}

//设置主题
setTheme()

//读取主进程的共享数据userSSHInfo
new_ssh(remote.getGlobal('shareData').userSSHInfo)
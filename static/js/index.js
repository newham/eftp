// index.js — SSH 主页面逻辑，所有 Node.js 操作通过 window.electronAPI (IPC) 完成

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

function getCurrentDir() { return ssh_list[current_ssh_id].currentDir }
function setCurrentDir(dir) { ssh_list[current_ssh_id].currentDir = dir }
function getUserSSHInfo(id = current_ssh_id) { return ssh_list[id].userSSHInfo }
function setUserSSHInfo(userSSHInfo) { ssh_list[current_ssh_id].userSSHInfo = userSSHInfo }
function getSSH_ID(id = current_ssh_id) { return ssh_list[id].sshId }
function setSSH(id, status) { ssh_list[id].sshStatus = status }  // null=connecting, -1=failed, 1=ok
function getSSH_Status(id = current_ssh_id) { return ssh_list[id].sshStatus }
function put_ls_history(current, dir) { ssh_list[current_ssh_id].ls_history.push({ currentDir: current, dir: dir }) }
function get_ls_history() { return ssh_list[current_ssh_id].ls_history }
function setIsShowHidden(isShow) { ssh_list[current_ssh_id].isShowHidden = isShow }
function getIsShowHidden() { return ssh_list[current_ssh_id].isShowHidden }
function plusInfos_count(n) { ssh_list[current_ssh_id].infos_count += n }
function resetInfos_count() { ssh_list[current_ssh_id].infos_count = 0 }
function getInfos_count() {
    const s = ssh_list[current_ssh_id]
    return s ? s.infos_count : 0
}
function resetFileList() { ssh_list[current_ssh_id].fileList = [] }
function getFileList() { return ssh_list[current_ssh_id].fileList }
function setBackIndex(id) { return ssh_list[current_ssh_id].backIndex = id }
function getBackIndex() { return ssh_list[current_ssh_id].backIndex }
function get_ls_lock() { return ssh_list[current_ssh_id].ls_lock }
function set_ls_lock(lock) { ssh_list[current_ssh_id].ls_lock = lock }
function get_copy_from() { return ssh_list[current_ssh_id].copy_from }
function set_copy_from(from) { ssh_list[current_ssh_id].copy_from = from }
// ---------------data-end--------------

function getHome(username, osType = 'Linux') {
    let home = `/home/${username}/`
    if (osType == 'Darwin') {
        home = `/Users/${username}/`
    } else if (osType == 'WindowsNT') {
        home = `/C/Users/${username}/`
    } else if (osType == 'Linux' && username == 'root') {
        home = `/root/`
    }
    return home
}

function addLock(isLock = false) {
    window.electronAPI.setLock(isLock)
}

function done_process(id, tg = 'success', msg = '') {
    document.getElementById(id).classList.remove('txt-success', 'txt-danger', 'txt-info')
    let txt_class = 'txt-success'
    if (tg == 'failed') txt_class = 'txt-danger'
    else if (tg == 'info') txt_class = 'txt-info'
    if (tg == 'success' || tg == 'failed') addLock(false)
    if (msg != "") msg = ' : ' + msg
    if (tg == 'success') {
        document.getElementById(id).style.padding = 0
        document.getElementById(id).innerHTML = ''
    } else {
        document.getElementById(id).innerHTML = tg + msg
        document.getElementById(id).classList.add(txt_class)
    }
    if (getInfos_count() > MAX_INFOS_NUM) clean_infos()
}

function open_file(id, file) {
    if (get_bs(id)) return false
    window.electronAPI.openFile(file).catch((err) => {
        alert(err)
    })
}

function addError(msg) {
    document.getElementById('infos').insertAdjacentHTML("beforeend", `<div class="line-div"><p class="txt-danger">${msg}</p></div>`)
}

let _infoIdCounter = 0
function addInfo(msg, file = '', isArray = false, path = '') {
    if (isArray) file = file.join(',<br>')
    const loading_html = LOADING_HTML
    // 用自增计数器保证唯一，避免同一毫秒内多次调用产生重复 id
    const id = `info_${++_infoIdCounter}`
    if (msg == 'download') {
        file = `<a onclick="open_file('${id}','${path + file}')" class="link">${file}</a>`
    }
    document.getElementById('infos').insertAdjacentHTML("beforeend", `<div class="line-div" id="line_${id}"><p id="${'info_' + id}"><label>${msg}</label>${file}</p><p id="${id}">${loading_html}</p></div>`)
    const sidebar = document.getElementById('sidebar')
    sidebar.scrollTop = sidebar.scrollHeight
    addLock(true)
    plusInfos_count(1)
    return id
}

let showPath = (path) => {
    document.querySelector('#path').innerHTML = path
}

function show_ssh_alert(color, msg = '正在连接...') {
    if (color == 'danger') msg = '连接失败! 请检查网络或ssh配置'
    document.querySelector('#file_list').innerHTML = `<tr class="no-hover"><td class="td-alert txt-${color}">${msg}</td></tr>`
}

function ls_up() { ls(UP_FILE_NAME) }
function ls_back() { ls(BACK_FILE_NAME) }
function ls_home() { ls(HOME_FILE_NAME) }

/**
 * 目录列表 —— 核心改动：使用 sftp.list 代替 ls 命令解析
 */
function ls(dir, isShowHidden = getIsShowHidden()) {
    const ssh_status = getSSH_Status()
    if (get_ls_lock()) return
    if (ssh_status == null) {
        showPath('')
        show_ssh_alert('warning')
        return
    }
    if (ssh_status == -1) {
        showPath('')
        show_ssh_alert('danger')
        return
    }
    if (dir == null && ssh_list[current_ssh_id].fileList.length > 0) {
        showPath(getCurrentDir())
        // ../行不在 fileList 中，需要单独补充渲染
        if (getCurrentDir() != "/") {
            const up_file = init_fileInfo()
            up_file.name = UP_FILE_NAME
            up_file.isDir = true
            up_file.time = ''
            document.querySelector('#file_list').insertAdjacentHTML('beforeend', getFileHTML(up_file))
        }
        ssh_list[current_ssh_id].fileList.forEach((fileInfo) => {
            document.querySelector('#file_list').insertAdjacentHTML('beforeend', getFileHTML(fileInfo))
        })
        return
    }
    resetFileList()
    let backIndex = getBackIndex()
    const ls_history = get_ls_history()
    const currentDir = getCurrentDir()
    if (dir) {
        if (dir == UP_FILE_NAME) {
            setCurrentDir(getParentPath(currentDir))
        } else if (dir == HOME_FILE_NAME) {
            setCurrentDir(getHome(getUserSSHInfo().username, getUserSSHInfo().osType))
        } else if (dir == BACK_FILE_NAME) {
            if (backIndex < ls_history.length - 1) backIndex += 2
            const back = ls_history[ls_history.length - backIndex]
            if (back && back.currentDir != currentDir) setCurrentDir(back.currentDir)
        } else {
            if (dir != '') backIndex = 0
            setCurrentDir(currentDir + dir + "/")
        }
    }
    showPath(`${getCurrentDir()} <img src="static/img/loading.gif">`)
    setBackIndex(backIndex)
    put_ls_history(getCurrentDir(), dir)
    set_ls_lock(true)

    // 先渲染 ".." 返回行
    document.querySelector('#file_list').innerHTML = ""
    if (getCurrentDir() != "/") {
        const up_file = init_fileInfo()
        up_file.name = UP_FILE_NAME
        up_file.isDir = true
        up_file.time = ''
        set_file_info_html(up_file)
    }

    const sshId = getSSH_ID()

    // 使用 sftp.list 获取目录列表
    window.electronAPI.sftpList(sshId, getCurrentDir()).then((result) => {
        if (!result.ok) {
            showPath(`<span class="txt-danger">${result.error || ''}</span>`)
            setCurrentDir(currentDir)
            set_ls_lock(false)
            return
        }

        let n = 0
        let over = false

        // 先显示目录，再显示文件（按名字排序）
        const dirs = result.files.filter(f => f.type === 'd').sort((a, b) => a.name.localeCompare(b.name))
        const files = result.files.filter(f => f.type !== 'd').sort((a, b) => a.name.localeCompare(b.name))
        const sorted = [...dirs, ...files]

        sorted.forEach((f) => {
            // 隐藏文件过滤
            if (!isShowHidden && f.name.startsWith('.')) return
            if (n >= MAX_LIST_NUM) {
                if (!over) {
                    over = true
                    document.querySelector('#file_list').insertAdjacentHTML("beforeend",
                        `<tr><td colspan="5" class="txt-center">只能显示前${MAX_LIST_NUM}行</td></tr>`)
                }
                return
            }

            const fileInfo = sftp_entry_to_fileInfo(f, n)
            n++
            set_file_info_html(fileInfo)
        })

        // 更新隐藏文件按钮样式
        if (isShowHidden) {
            document.getElementById('btn-show-hidden').classList.add('txt-info')
        } else {
            document.getElementById('btn-show-hidden').classList.remove('txt-info')
        }

        showPath(getCurrentDir())
        set_ls_lock(false)
    }).catch((err) => {
        showPath(`<span class="txt-danger">${err}</span>`)
        set_ls_lock(false)
        setCurrentDir(currentDir)
    })
}

/**
 * 将 sftp.list 返回的条目转换为内部 fileInfo 对象
 */
function sftp_entry_to_fileInfo(f, id) {
    const fileInfo = init_fileInfo()
    fileInfo.id = id
    fileInfo.name = f.name
    fileInfo.isDir = (f.type === 'd')
    fileInfo.size = f.size || 0
    fileInfo.formatSize = formatSize(fileInfo.size)
    fileInfo.type = getFileType(f.name, fileInfo.isDir)
    fileInfo.rights = f.rights ? f.rights.octal || '' : ''

    // 格式化修改时间
    if (f.modifyTime) {
        const d = new Date(f.modifyTime * 1000)
        const mon = d.toLocaleString('en', { month: 'short' })
        const day = String(d.getDate()).padStart(2, '0')
        const hhmm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        fileInfo.time = ` ${hhmm} ${mon}${day}`
    } else {
        fileInfo.time = ''
    }
    return fileInfo
}

let init_fileInfo = () => {
    return { rights: "", fileCount: 0, type: "file", user: "", group: "", size: 0, formatSize: '', month: "", day: "", year: "", name: "", isDir: true, id: 0, time: '' }
}

function getFileHTML(fileInfo) {
    let font_class = ""
    if (fileInfo.name.startsWith('.')) font_class = 'font-light'
    if (fileInfo.isDir) {
        let tr_html = `<tr oncontextmenu="showFolderMenu(${fileInfo.id})">`
        if (fileInfo.name == UP_FILE_NAME) tr_html = '<tr>'
        return `${tr_html}<td class="td-icon"><img class="icon" src="static/img/svg/doctype/icon-${fileInfo.type}-m.svg"></td><td class="td-head"><a onclick="ls('${fileInfo.name}')" href="#" class="hover-link"><div class="${font_class}">${fileInfo.name}</div></a></td><td>${fileInfo.time}</td><td colspan="2"></td></div>`
    } else {
        return `<tr oncontextmenu="showFileMenu(${fileInfo.id})" id="f-${fileInfo.id}"><td class="td-icon"><img class="icon" src="static/img/svg/doctype/icon-${fileInfo.type}-m.svg"></td><td class="td-head"><div class="${font_class}">${fileInfo.name}</div></td><td>${fileInfo.time}</td><td>${fileInfo.formatSize}</td><td class="td-download"> <a href="#" onclick="download_file('${fileInfo.name}',${fileInfo.size})">⇩</a></div>`
    }
}

function set_file_info_html(fileInfo) {
    // ../ 仅用于 DOM 展示，不计入 fileList，避免 id 与数组索引错位
    if (fileInfo.name !== UP_FILE_NAME) {
        ssh_list[current_ssh_id].fileList.push(fileInfo)
    }
    document.querySelector('#file_list').insertAdjacentHTML('beforeend', getFileHTML(fileInfo))
}

function getParentPath(file) {
    if (file == "" || file == "/") return file
    let i = file.lastIndexOf("/")
    if (i == file.length - 1) file = file.slice(0, file.length - 2)
    i = file.lastIndexOf("/")
    return file.substr(0, i + 1)
}

// ==================== 上传 ====================

/**
 * 上传多个文件（支持断点续传，逐个上传并显示进度）
 */
function upload_file(files) {
    const currentDir = getCurrentDir()
    const sshId = getSSH_ID()

    files.forEach((localPath) => {
        const fileName = getFileName(localPath)
        const remotePath = currentDir + fileName
        const id = addInfo('upload', fileName)
        push_bs(id, fileName, '↑')

        // 每个文件独立的传输 ID，避免多文件并发时进度 channel 串台
        const transferId = `${sshId}_${id}`

        // 注册进度监听（按 transferId 隔离）
        const unsubscribe = window.electronAPI.onSftpProgress(transferId, (progress) => {
            set_transfer_progress(id, progress.transferred, progress.total, progress.percent)
        })

        window.electronAPI.sftpUpload(sshId, localPath, remotePath, transferId).then((result) => {
            unsubscribe()
            if (result.ok) {
                done_process(id)
                remove_bs(id)
                ls('')
            } else {
                done_process(id, 'failed', result.error)
                remove_bs(id)
            }
        }).catch((err) => {
            unsubscribe()
            done_process(id, 'failed', String(err))
            remove_bs(id)
        })
    })
}

function upload() {
    showOpenFilesWin((ok, files) => {
        if (ok) upload_file(files)
    })
}

function getFolderName(path, withTail = true) {
    const paths = path.split('/')
    return paths[paths.length - 2] + (withTail ? '/' : '')
}

function upload_folder() {
    showOpenFolderWin((ok, folder) => {
        if (!ok) return
        const toFolder = getCurrentDir() + getFolderName(folder)
        const id = addInfo('upload', folder)
        push_bs(id, folder, '↑')
        const sshId = getSSH_ID()
        window.electronAPI.sftpPutDirectory(sshId, folder, toFolder).then((result) => {
            if (result.ok) {
                done_process(id)
                remove_bs(id)
                ls('')
            } else {
                done_process(id, 'failed', result.error)
                remove_bs(id)
            }
        }).catch((err) => {
            done_process(id, 'failed', String(err))
            remove_bs(id)
        })
    })
}

// ==================== 下载 ====================

/**
 * 下载单个文件（支持断点续传，实时进度）
 */
function download_file(file, f_size) {
    showOpenFolderWin((ok, folder) => {
        if (!ok) return
        const currentDir = getCurrentDir()
        const id = addInfo('download', file, false, folder)
        push_bs(id, file, '↓')
        const sshId = getSSH_ID()
        const localPath = folder + file
        const remotePath = currentDir + file

        // 每次下载独立的传输 ID
        const transferId = `${sshId}_${id}`

        // 注册进度监听（按 transferId 隔离）
        const unsubscribe = window.electronAPI.onSftpProgress(transferId, (progress) => {
            set_transfer_progress(id, progress.transferred, progress.total, progress.percent)
        })

        window.electronAPI.sftpDownload(sshId, remotePath, localPath, transferId).then((result) => {
            unsubscribe()
            remove_bs(id)
            if (result.ok) {
                done_process(id)
                appendHTMLByID(`info_${id}`, ` <a onclick="rm_file('${localPath}',${id})" class="txt-danger"> 删除</a>`)
            } else {
                done_process(id, 'failed', result.error)
            }
        }).catch((err) => {
            unsubscribe()
            done_process(id, 'failed', String(err))
            remove_bs(id)
        })
    })
}

/**
 * 设置传输进度显示
 */
function set_transfer_progress(id, transferred, total, percent) {
    if (percent >= 100) {
        done_process(id)
        return
    }
    set_html(id,
        `<img class="img-loading" src="static/img/loading-4.gif"><span> ${formatSize(transferred)}/${formatSize(total)} <span class="txt-info">${percent}%</span></span>`)
}

// ==================== 后台任务列表 ====================

function push_bs(id, file, status) {
    bs_list.push({ id, file, status })
    addClassByID('btn_bs', 'txt-info')
}

function remove_bs(id) {
    bs_list.forEach((item, i) => {
        if (item.id == id) bs_list.splice(i, 1)
    })
    if (bs_list.length < 1) delClassByID('btn_bs', 'txt-info')
}

function get_bs(id) {
    let bs = null
    bs_list.forEach((item) => { if (item.id == id) bs = item })
    return bs
}

function rm_file(file, id) {
    window.electronAPI.fsUnlink(file).then(() => {
        const el = document.getElementById(`line_${id}`)
        if (el) el.remove()
    })
}

// ==================== 文件操作 ====================

function del_file(file, isDir) {
    const f_tag = isDir ? "文件夹" : "文件"
    if (!confirm(`确定删除-${f_tag}-[${file}] ?`)) return
    const id = addInfo('rm', file)
    const sshId = getSSH_ID()
    const remotePath = getCurrentDir() + file
    if (isDir) {
        window.electronAPI.sftpRmdir(sshId, remotePath).then((result) => {
            if (result.ok) { done_process(id); ls('') }
            else done_process(id, 'failed', result.error)
        }).catch((err) => done_process(id, 'failed', String(err)))
    } else {
        window.electronAPI.sftpDelete(sshId, remotePath).then((result) => {
            if (result.ok) { done_process(id); ls('') }
            else done_process(id, 'failed', result.error)
        }).catch((err) => done_process(id, 'failed', String(err)))
    }
}

function rename_file(new_name = document.getElementById('file_rename').value) {
    if (!new_name || new_name == "") return
    const old_name = document.getElementById('file_rename').dataset.oldname
    if (!old_name) return
    if (event && event.type == 'keydown' && event.keyCode != 13) return
    const id = addInfo('mv', `${old_name} → ${new_name}`)
    const sshId = getSSH_ID()
    window.electronAPI.sftpRename(sshId, getCurrentDir() + old_name, getCurrentDir() + new_name).then((result) => {
        if (result.ok) { done_process(id); ls('') }
        else done_process(id, 'failed', result.error)
    }).catch((err) => done_process(id, 'failed', String(err)))
    show_folder_dialog(false)
}

function show_rename_dialog(isShow, filename = '') {
    if (isShow) {
        document.getElementById('file_rename').value = filename
        document.getElementById('file_rename').dataset.oldname = filename
        show('rename_dialog', true)
        document.getElementById('file_rename').focus()
    } else {
        show('rename_dialog', false)
        document.getElementById('file_rename').value = ''
    }
}

function mkdir(dir_name = document.getElementById('dir_name').value) {
    if (!dir_name || dir_name == "") { show_folder_dialog(false); return }
    if (checkRename(dir_name, true)) { alert('文件名重复'); return }
    const id = addInfo('mkdir', dir_name)
    const sshId = getSSH_ID()
    window.electronAPI.sftpMkdir(sshId, getCurrentDir() + dir_name).then((result) => {
        if (result.ok) { done_process(id); ls('') }
        else done_process(id, 'failed', result.error)
    }).catch((err) => done_process(id, 'failed', String(err)))
    show_folder_dialog(false)
}

// ==================== 压缩/解压（通过 exec）====================

function zip_folder(folder) {
    const currentDir = getCurrentDir()
    const id = addInfo('zip', folder)
    const sshId = getSSH_ID()
    window.electronAPI.sshExec(sshId, `cd '${currentDir}' && zip -r '${folder}.zip' '${folder}'`, [], {}).then((result) => {
        if (result.ok) { done_process(id); ls('') }
        else done_process(id, 'failed', result.error || result.stderr)
    }).catch((err) => done_process(id, 'failed', String(err)))
}

function unzip_file(file) {
    let cmd = ''
    const currentDir = getCurrentDir()
    if (file.endsWith('.zip')) {
        cmd = `unzip -o '${currentDir + file}' -d '${currentDir}'`
    } else if (file.endsWith('.tar.gz')) {
        cmd = `tar -zxvf '${currentDir + file}' -C '${currentDir}'`
    } else if (file.endsWith('.tar.xz')) {
        cmd = `tar -xvf '${currentDir + file}' -C '${currentDir}'`
    } else return
    const id = addInfo('unzip', file)
    const sshId = getSSH_ID()
    window.electronAPI.sshExec(sshId, cmd, [], {}).then((result) => {
        if (result.ok) { done_process(id); ls('') }
        else done_process(id, 'failed', result.error || result.stderr)
    }).catch((err) => done_process(id, 'failed', String(err)))
}

// ==================== copy / cut / paste ====================

function copy(from = get_copy_from(), to = "", cmd = 'cp') {
    if (from && from != "") {
        const id = addInfo(`${cmd} from`, from)
        set_copy_from(getCurrentDir() + from)
        done_process(id)
    }
    if (to && to != "" && get_copy_from() != "") {
        const id = addInfo(`${cmd} to`, to)
        let fullCmd = cmd == 'cp'
            ? `cp -r '${get_copy_from()}' '${to}'`
            : `mv '${get_copy_from()}' '${to}'`
        const sshId = getSSH_ID()
        window.electronAPI.sshExec(sshId, fullCmd, [], {}).then((result) => {
            if (result.ok) { done_process(id); set_copy_from(''); ls('') }
            else done_process(id, 'failed', result.error || result.stderr)
        }).catch((err) => done_process(id, 'failed', String(err)))
    }
}

// ==================== 空间信息 ====================

function show_space() {
    if (!check_ssh()) return
    const sshId = getSSH_ID()
    window.electronAPI.sshExec(sshId, 'df -h', [], {}).then((result) => {
        if (result.stdout) {
            set_html('left_space', parse_df_line(result.stdout))
        } else {
            set_html('left_space', result.stderr || result.error || '')
        }
        show('space_dialog', true)
    }).catch((err) => {
        set_html('left_space', String(err))
        show('space_dialog', true)
    })
}

function parse_df_line(text) {
    let html = ''
    const os_type = getUserSSHInfo().osType
    const lines = text.split('\n')
    lines.forEach((line) => {
        if (!line.trim()) return
        const line_items = line.trim().split(/\s+/)
        if (line_items[0] == 'map' && os_type == 'Darwin') return
        let tag_class = ''
        const left_percentage = line_items[4]
        if (left_percentage == '100%') tag_class = 'txt-danger'
        else if (left_percentage <= '30%') tag_class = 'txt-success'
        else if (left_percentage <= '50%') tag_class = 'txt-info'
        else if (left_percentage <= '70%') tag_class = 'txt-warning'
        else if (left_percentage <= '99%') tag_class = 'txt-danger'
        html += `<tr><td class="txt-left">${line_items[0]}</td><td class="txt-left">${line_items[1]}</td><td class="txt-left">${line_items[2]}</td><td class="txt-left">${line_items[3]}</td><td><span class="${tag_class}">${line_items[4]}</span></td></tr>\n`
    })
    return html
}

// ==================== 工具函数 ====================

const K = 1024
function formatSize(size) {
    if (size < K) return `${size}B`
    if (size < K * K) return `${parseInt(size / K)}K`
    if (size < K * K * K) return `${parseInt(size / K / K)}M`
    return `${(size / K / K / K).toFixed(1)}G`
}

function getFileFullName(file, tail) { return file.replace(tail, '') }
function getFileParentName(file) {
    if (file == "") return ""
    return file.slice(0, file.lastIndexOf("."))
}

function getFileType(file, is_folder = false) {
    if (is_folder) return "file"
    const obj = file.lastIndexOf(".")
    if (obj < 0) return "nor"
    const extension = file.slice(obj + 1)
    switch (extension) {
        case 'doc': case 'docx': return 'doc'
        case 'ppt': case 'pptx': return 'ppt'
        case 'xls': case 'xlsx': return 'xls'
        case 'pdf': return 'pdf'
        case 'apk': return 'apk'
        case 'dmg': return 'ipa'
        case 'psd': return 'ps'
        case 'html': case 'htm': case 'url': return 'shared-link'
        case 'txt': case 'md': case 'json': case 'yml': case 'conf': case 'sh': case 'sql': return 'txt'
        case 'mp4': case 'rmvb': case 'mkv': case 'avi': return 'video'
        case 'flv': return 'flv'
        case 'bt': case 'torrent': return 'bt'
        case 'mp3': case 'm4a': case 'flac': case 'wma': return 'audio'
        case 'jpg': case 'jpeg': case 'png': case 'bmp': case 'gif': case 'svg': return 'pic'
        case 'zip': case '7z': case 'gz': case 'rar': case 'tar': case 'xz': return 'zip'
        case 'c': case 'cpp': case 'go': case 'java': case 'py': case 'ipynb': case 'js': case 'css': return 'code'
        default: return 'nor'
    }
}

function getFileName(file) {
    if (file == "") return ""
    return file.substr(file.lastIndexOf("/") + 1)
}

function set_html(id, html) {
    document.getElementById(id).innerHTML = html
}

function show(id, isShow) {
    document.getElementById(id).style.display = isShow ? 'block' : 'none'
}

function show_folder_dialog(isShow) {
    show('new_folder_dialog', isShow)
    if (isShow) {
        document.getElementById('dir_name').focus()
    } else {
        document.getElementById('dir_name').value = ''
    }
}

function keydown_mkdir() {
    if (event.keyCode == 13) mkdir()
    else if (event.keyCode == 27) show_folder_dialog(false)
}

function checkRename(filename, isDir) {
    let isRename = false
    getFileList().forEach((file) => {
        if (file.name == filename && file.isDir == isDir) isRename = true
    })
    return isRename
}

function to_login() {
    window.electronAPI.newWin()
}

// ==================== SSH 连接 ====================

var osTypeList = ['Linux', 'Darwin', 'WindowsNT']

function connectSSH(ssh_id = current_ssh_id) {
    const userSSHInfo = getUserSSHInfo(ssh_id)
    const sshId = getSSH_ID(ssh_id)
    const id = addInfo('connect', `${userSSHInfo.username}@${userSSHInfo.host}:${userSSHInfo.port}`)
    show_ssh_alert('warning')
    window.electronAPI.sshConnect(sshId, userSSHInfo).then((result) => {
        if (!result.ok) {
            setSSH(ssh_id, -1)
            setTabs(ssh_id)
            if (ssh_id == current_ssh_id) show_ssh_alert('danger')
            done_process(id, 'failed', result.error)
            return
        }
        setSSH(ssh_id, 1)
        setTabs(ssh_id)
        // 获取 os 类型
        window.electronAPI.sshExec(sshId, 'uname -s', [], {}).then((r) => {
            if (r.ok && r.stdout) {
                const os_type = r.stdout.replace(/\n|\r/g, '').trim()
                if (!osTypeList.includes(os_type)) {
                    alert(`暂时不支持连接到${os_type}系统！`)
                    return
                }
                userSSHInfo.osType = os_type
                setUserSSHInfo(userSSHInfo)
                saveUserSSHInfo(userSSHInfo)
            }
            ls(HOME_FILE_NAME)
            done_process(id)
        }).catch(() => {
            ls(HOME_FILE_NAME)
            done_process(id)
        })
    }).catch((err) => {
        setSSH(ssh_id, -1)
        setTabs(ssh_id)
        if (ssh_id == current_ssh_id) show_ssh_alert('danger')
        done_process(id, 'failed', String(err))
    })
}

function setTitle() {
    const userSSHInfo = getUserSSHInfo()
    document.getElementById('head-title').innerHTML = userSSHInfo.label
}

function clean_infos() {
    document.getElementById('infos').innerHTML = ''
    resetInfos_count()
}

function saveUserSSHInfo(userSSHInfo) {
    readConf((ok, conf) => {
        if (ok) {
            conf[getUserSSHInfo().id] = userSSHInfo
            writeConf(conf, (err) => { if (err) console.log(err) })
        }
    })
}

// ==================== 收藏夹 ====================

function favourite_folder(folder, current = getCurrentDir()) {
    const favourites = getUserSSHInfo().favourites
    let isHave = false
    favourites.forEach((fav) => {
        if (fav.currentDir == current && folder == fav.folder) isHave = true
    })
    if (isHave) { alert('已被收藏!'); showfavouritesMenu(false); return }
    const new_favourite = { currentDir: current, folder: folder }
    favourites.push(new_favourite)
    getUserSSHInfo().favourites = favourites
    saveUserSSHInfo(getUserSSHInfo())
    showfavouritesMenu(false)
}

let isfavouritesMenuShow = true

function setfavouritesMenu() {
    setHTMLByID('favourites', `<button onclick="favourite_folder('${getFolderName(getCurrentDir(), false)}','${getParentPath(getCurrentDir())}')">♥ 添加收藏</button>`)
    getUserSSHInfo().favourites.forEach((fav, i) => {
        appendHTMLByID('favourites', `\n<hr><button onclick="goFavourite(${i})" oncontextmenu="showFavouriteMenu(${i})">${fav.currentDir}${fav.folder}</button>`)
    })
}

function goFavourite(id) {
    const fav = getUserSSHInfo().favourites[id]
    setCurrentDir(fav.currentDir)
    ls(fav.folder)
    showfavouritesMenu()
}

function del_favourite(id) {
    const favourites = getUserSSHInfo().favourites
    favourites.splice(id, 1)
    getUserSSHInfo().favourites = favourites
    saveUserSSHInfo(getUserSSHInfo())
    showfavouritesMenu(true)
}

function showfavouritesMenu(isShow = isfavouritesMenuShow) {
    setfavouritesMenu()
    const favouritesMenu = document.getElementById('favouritesMenu')
    favouritesMenu.style.display = isShow ? 'block' : 'none'
    isfavouritesMenuShow = !isShow
}

function showHiddenFile() {
    const isShowHidden = !getIsShowHidden()
    setIsShowHidden(isShowHidden)
    ls('', isShowHidden)
}

function check_ssh(ssh_id = current_ssh_id) {
    return getSSH_Status(ssh_id) === 1
}

// ==================== 标签页 ====================

window.electronAPI.onAddSSH((userSSHInfo) => {
    new_ssh(userSSHInfo)
})

function new_ssh(userSSHInfo) {
    const sshId = `ssh_${Date.now()}_${ssh_list.length}`
    ssh_list.push({
        userSSHInfo: userSSHInfo,
        currentDir: '',
        sshId: sshId,
        sshStatus: null,
        fileList: [],
        isShowHidden: false,
        infos_count: 0,
        ls_history: [],
        backIndex: 0,
        ls_lock: false,
        copy_from: "",
    })
    current_ssh_id = ssh_list.length - 1
    setTitle()
    showPath('')
    setTabs()
    connectSSH(current_ssh_id)
}

function setTabActive(id) {
    const tabs = document.getElementById('tab-bar').children
    for (let i = 0; i < tabs.length; i++) {
        if (i == id) tabs[i].classList.add('tab-active')
        else tabs[i].classList.remove('tab-active')
    }
}

function setTabs(ssh_id = current_ssh_id) {
    document.getElementById('tab-bar').innerHTML = ''
    ssh_list.forEach((ssh, i) => {
        const active_css = (i == current_ssh_id) ? 'class="tab-active"' : ''
        let tag = '◆'
        let tag_class = 'txt-success'
        if (ssh.sshStatus == -1) tag_class = 'txt-danger'
        else if (ssh.sshStatus == null) tag_class = 'txt-warning'
        document.getElementById('tab-bar').insertAdjacentHTML("beforeend", `<div ${active_css} id="tab-${i}" oncontextmenu="showTabMenu(${i})" onclick="to_ssh(${i})"><span class="${tag_class}">${tag} </span>${ssh.userSSHInfo.label}</div>`)
    })
    if (ssh_id == current_ssh_id) {
        document.getElementById('file_list').innerHTML = ''
    }
}

function closeTab(id) {
    const sshStatus = getSSH_Status(id)
    if (sshStatus == null) { alert('还不能关闭，正在连接，请稍后！'); return }
    const i = addInfo('close', getUserSSHInfo(id).label)
    if (sshStatus === 1) {
        window.electronAPI.sshDispose(getSSH_ID(id))
    }
    ssh_list.splice(id, 1)
    done_process(i)
    to_ssh(id - 1 > 0 ? id - 1 : 0, true)
}

function to_ssh(id, isNew = false) {
    if (ssh_list.length == 0) { document.location.href = 'login.html'; return }
    if (id == current_ssh_id && !isNew) return
    current_ssh_id = id
    setTabs()
    ls()
}

function showSidebar() {
    const btn = document.getElementById('siderbar-hide-btn')
    showElement('sidebar', (isShow) => {
        if (!isShow) {
            document.documentElement.style.setProperty('--side-bar-r-w', '0px')
            btn.style.removeProperty('color')
        } else {
            document.documentElement.style.setProperty('--side-bar-r-w', '300px')
            btn.style.setProperty('color', 'var(--blue-2)')
        }
    })
}

function showElement(id, f = null) {
    const item = document.getElementById(id)
    if (item.style.display == 'none') {
        if (f) f(true)
        item.style.display = 'block'
    } else {
        if (f) f(false)
        item.style.display = 'none'
    }
}

function show_backstageMenu() {
    showElement('backstageMenu', (isShow) => {
        if (isShow) setBsMenu()
    })
}

function setBsMenu() {
    document.getElementById('bs_list').innerHTML = ''
    if (bs_list.length > 0) {
        bs_list.forEach((item, i) => {
            const sep = i > 0 ? '<hr>' : ''
            appendHTMLByID('bs_list', `\n${sep}<button>${item.status} ${item.file}</button>`)
        })
    } else {
        appendHTMLByID('bs_list', `\n<button>空</button>`)
    }
}

function hideMenu() {
    document.getElementById('backstageMenu').style.display = 'none'
    document.getElementById('favouritesMenu').style.display = 'none'
    isfavouritesMenuShow = true
}

function refresh() {
    if (getSSH_Status() == -1) {
        setSSH(current_ssh_id, null)
        setTabs()
        connectSSH()
    } else if (getSSH_Status() === 1) {
        ls('')
    }
}

// ==================== 初始化 ====================

setTheme().then(() => {
    window.electronAPI.getShareData().then((shareData) => {
        if (shareData && shareData.userSSHInfo && shareData.userSSHInfo.host) {
            new_ssh(shareData.userSSHInfo)
        }
    })
})

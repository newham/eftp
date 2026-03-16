// login.js — 登录页逻辑，SSH 连接测试通过主进程 IPC 完成

var userSSH_list = []
var lock = false       // 打开编辑框后，其他图标 click 锁
var save_lock = false  // 保存、取消按钮锁

// 临时 SSH ID（用于主进程连接池，login 页只做测试连接）
const LOGIN_TEST_SSH_ID = '__login_test__'

function show_dialog(isShow, title = '新建HOST') {
    if (isShow) {
        document.getElementById('dialog_title').innerHTML = title
        lock = true
        document.getElementById('new_ssh_dialog').style.display = 'block'
        document.getElementById('username').focus()
    } else {
        if (save_lock) return
        lock = false
        document.getElementById('new_ssh_dialog').style.display = 'none'
    }
}

function new_ssh() {
    if (lock) return false
    setSSHDialogVal(null)
    show_dialog(true)
}

function saveUserSSHInfo(userSSHInfo) {
    // 编辑已有记录：直接覆盖，不做连接测试
    if (userSSHInfo.id != -1) {
        userSSH_list[userSSHInfo.id] = userSSHInfo
        writeConf(userSSH_list, (err) => {
            if (err) console.log(err)
            else loadConf()
        })
        show_dialog(false)
        return
    }

    // 新增：先测试连接
    document.getElementById('host_address').innerHTML = `${userSSHInfo.username}@${userSSHInfo.host}`
    show('loading_dialog', true)
    save_lock = true

    window.electronAPI.sshConnect(LOGIN_TEST_SSH_ID, userSSHInfo).then((result) => {
        show('loading_dialog', false)
        save_lock = false
        // 测试完成立即断开
        window.electronAPI.sshDispose(LOGIN_TEST_SSH_ID)

        if (!result.ok) {
            show_dialog(true, `<div class="txt-danger">连接失败: ${result.error}</div>`)
            return
        }

        readConf((ok, conf) => {
            if (ok) {
                userSSHInfo.id = conf.length
                conf.push(userSSHInfo)
            } else {
                userSSHInfo.id = 0
                conf = [userSSHInfo]
            }
            writeConf(conf, (err) => {
                if (err) console.log(err)
                else {
                    show_dialog(false)
                    loadConf()
                }
            })
        })
    })
}

var tmp_favourites = []

function addUserSSHInfo() {
    if (save_lock) return
    const host = document.getElementById('host').value
    const username = document.getElementById('username').value
    let label = document.getElementById('label').value
    const password = document.getElementById('password').value
    const privateKey = document.getElementById('privateKey').value
    let port = document.getElementById('port').value
    const id = document.getElementById('id').value
    const color = document.getElementById('color').value
    const osType = document.getElementById('osType').value

    if (host == "" || username == "" || (password == "" && privateKey == "")) {
        alert('请正确输入必填项!')
        return
    }
    if (port == "") port = 22
    if (label == "") label = username + '@' + host

    const userSSHInfo = {
        id: id,
        host: host,
        username: username,
        password: password,
        ssh: privateKey !== "",
        privateKey: privateKey,
        characterSet: 'utf8',
        port: port,
        label: label,
        favourites: tmp_favourites,
        color: color,
        osType: osType,
    }

    saveUserSSHInfo(userSSHInfo)
}

function selectPK() {
    if (save_lock) return
    showOpenFileWin((ok, pkfile) => {
        if (!ok) return
        document.getElementById('privateKey').value = pkfile
        document.getElementById('password').value = ''
    })
}

function loadConf() {
    const list_html = document.getElementById('userSSH_list')
    list_html.innerHTML = ""
    readConf((ok, conf) => {
        if (ok) userSSH_list = conf

        userSSH_list.forEach(userSSHInfo => {
            let icon = ''
            if (userSSHInfo.osType == 'Darwin') {
                icon = '<img src="static/img/svg/os/icon-mac.svg">'
            } else if (userSSHInfo.osType == 'Linux') {
                icon = '<img src="static/img/svg/os/icon-linux.svg">'
            } else if (userSSHInfo.osType == 'WindowsNT') {
                icon = '<img src="static/img/svg/os/icon-win.svg">'
            }
            list_html.insertAdjacentHTML('beforeend', `<div class="c-2-5"><a class="box bg-color-${userSSHInfo.color}" oncontextmenu="showHostMenu(${userSSHInfo.id})" onclick="goSSH(${userSSHInfo.id})">${icon}${userSSHInfo.label}<br><label>${userSSHInfo.username}@${userSSHInfo.host}</label></a></div>`)
        })

        list_html.insertAdjacentHTML('beforeend', '<div class="c-2-5"><a class="box" onclick="new_ssh()">＋<br><label>New Host</label></a></div>')
    })
}

function goSSH(id) {
    if (lock) return false
    const userSSHInfo = userSSH_list[id]
    window.electronAPI.goSSH(userSSHInfo)
}

function delSSHInfo(id) {
    if (lock) return false
    if (!confirm(`确定删除 [${userSSH_list[id].label}]?`)) return false
    userSSH_list.splice(id, 1)
    userSSH_list.forEach((info, i) => { info.id = i })
    writeConf(userSSH_list, (err) => {
        if (err) console.log(err)
        else loadConf()
    })
}

function editSSHInfo(userSSHInfo) {
    if (lock) return false
    setSSHDialogVal(userSSHInfo)
    tmp_favourites = userSSHInfo.favourites || []
    show_dialog(true, '编辑Host')
}

function setSSHDialogVal(userSSHInfo) {
    let color = Math.floor(Math.random() * 7)
    if (userSSHInfo) {
        color = userSSHInfo.color
        document.getElementById('host').value = userSSHInfo.host
        document.getElementById('username').value = userSSHInfo.username
        document.getElementById('label').value = userSSHInfo.label
        document.getElementById('password').value = userSSHInfo.password
        document.getElementById('privateKey').value = userSSHInfo.privateKey
        document.getElementById('port').value = userSSHInfo.port
        document.getElementById('id').value = userSSHInfo.id
        document.getElementById('color').value = color
        document.getElementById('osType').value = userSSHInfo.osType
    } else {
        document.getElementById('host').value = ""
        document.getElementById('username').value = ""
        document.getElementById('label').value = ""
        document.getElementById('password').value = ""
        document.getElementById('privateKey').value = ""
        document.getElementById('port').value = 22
        document.getElementById('id').value = -1
        document.getElementById('color').value = color
        document.getElementById('osType').value = ''
    }
    setColor(color)
}

var osTypeList = ['Linux', 'Darwin', 'WindowsNT']

function setOSType(osType = 'Linux') {
    const os_group = document.getElementById('os-group').children
    for (let i = 0; i < os_group.length; i++) {
        if (i == osTypeList.indexOf(osType)) {
            os_group[i].classList.add('active')
            document.getElementById('osType').value = osType
        } else {
            os_group[i].classList.remove('active')
        }
    }
}

function setColor(color = 0) {
    const color_group = document.getElementById('color-group').children
    for (let i = 0; i < color_group.length; i++) {
        if (i == color) {
            color_group[i].classList.add('active')
            document.getElementById('color').value = color
        } else {
            color_group[i].classList.remove('active')
        }
    }
}

setTheme()
loadConf()

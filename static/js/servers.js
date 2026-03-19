// servers.js — 服务器管理页面逻辑

var userSSH_list = []        // 全部已保存的 SSH 服务器配置
var ssh_dialog_lock = false   // 编辑框开启时锁住其他操作
var ssh_save_lock = false     // 保存/取消按钮锁（连接测试期间）

const LOGIN_TEST_SSH_ID = '__login_test__'

// ==================== 服务器主页显示控制 ====================

function showServerHome() {
    loadServerList()
    document.getElementById('server-home').style.display = 'flex'
}

function hideServerHome() {
    document.getElementById('server-home').style.display = 'none'
}

// ==================== 新增/编辑对话框 ====================

function showSSHDialog(title = '新建HOST') {
    document.getElementById('dialog_title').innerHTML = title
    ssh_dialog_lock = true
    document.getElementById('new_ssh_dialog').style.display = 'block'
    document.getElementById('username').focus()
}

function hideSSHDialog() {
    if (ssh_save_lock) return
    ssh_dialog_lock = false
    document.getElementById('new_ssh_dialog').style.display = 'none'
}

function new_ssh_dialog() {
    setSSHDialogVal(null)
    showSSHDialog('新建HOST')
}

function editSSHInfo(userSSHInfo) {
    setSSHDialogVal(userSSHInfo)
    tmp_favourites = userSSHInfo.favourites || []
    showSSHDialog('编辑Host')
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
        document.getElementById('ssh_id').value = userSSHInfo.id
        document.getElementById('color').value = color
        document.getElementById('osType').value = userSSHInfo.osType
    } else {
        document.getElementById('host').value = ''
        document.getElementById('username').value = ''
        document.getElementById('label').value = ''
        document.getElementById('password').value = ''
        document.getElementById('privateKey').value = ''
        document.getElementById('port').value = 22
        document.getElementById('ssh_id').value = -1
        document.getElementById('color').value = color
        document.getElementById('osType').value = ''
    }
    setColor(color)
}

var tmp_favourites = []

function saveSSHDialogInfo() {
    if (ssh_save_lock) return
    const host = document.getElementById('host').value
    const username = document.getElementById('username').value
    let label = document.getElementById('label').value
    const password = document.getElementById('password').value
    const privateKey = document.getElementById('privateKey').value
    let port = document.getElementById('port').value
    const id = document.getElementById('ssh_id').value
    const color = document.getElementById('color').value
    const osType = document.getElementById('osType').value

    if (host === '' || username === '' || (password === '' && privateKey === '')) {
        alert('请正确输入必填项!')
        return
    }
    if (port === '') port = 22
    if (label === '') label = username + '@' + host

    const userSSHInfo = {
        id: id,
        host: host,
        username: username,
        password: password,
        ssh: privateKey !== '',
        privateKey: privateKey,
        characterSet: 'utf8',
        port: port,
        label: label,
        favourites: tmp_favourites,
        color: color,
        osType: osType,
    }

    saveUserSSHConfig(userSSHInfo)
}

function saveUserSSHConfig(userSSHInfo) {
    // 编辑已有记录：直接覆盖，不做连接测试
    if (userSSHInfo.id != -1) {
        userSSH_list[userSSHInfo.id] = userSSHInfo
        writeConf(userSSH_list, (err) => {
            if (err) console.log(err)
            else loadServerList()
        })
        hideSSHDialog()
        return
    }

    // 新增：先测试连接
    document.getElementById('host_address').innerHTML = `${userSSHInfo.username}@${userSSHInfo.host}`
    show('loading_dialog', true)
    ssh_save_lock = true

    window.electronAPI.sshConnect(LOGIN_TEST_SSH_ID, userSSHInfo).then((result) => {
        show('loading_dialog', false)
        ssh_save_lock = false
        window.electronAPI.sshDispose(LOGIN_TEST_SSH_ID)

        if (!result.ok) {
            showSSHDialog(`<div class="txt-danger">连接失败: ${result.error}</div>`)
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
                    hideSSHDialog()
                    loadServerList()
                }
            })
        })
    })
}

function delSSHInfo(id) {
    if (!confirm(`确定删除 [${userSSH_list[id].label}]?`)) return
    userSSH_list.splice(id, 1)
    userSSH_list.forEach((info, i) => { info.id = i })
    writeConf(userSSH_list, (err) => {
        if (err) console.log(err)
        else loadServerList()
    })
}

function selectPK() {
    if (ssh_save_lock) return
    showOpenFileWin((ok, pkfile) => {
        if (!ok) return
        document.getElementById('privateKey').value = pkfile
        document.getElementById('password').value = ''
    })
}

// ==================== 服务器列表渲染 ====================

// 颜色映射
const SERVER_COLORS = [
    'var(--blue-1)',    // 0: 蓝
    'OrangeRed',        // 1: 红
    '#e79f04',          // 2: 橙
    '#339933',          // 3: 绿
    '#8A2BE2',          // 4: 紫
    '#ff7801',          // 5: 橙黄
    'darkgray',         // 6: 灰
]

function loadServerList() {
    const listEl = document.getElementById('userSSH_list')
    listEl.innerHTML = ''
    readConf((ok, conf) => {
        if (ok) userSSH_list = conf
        else userSSH_list = []

        if (userSSH_list.length === 0) {
            listEl.innerHTML = '<div class="server-home-empty">暂无服务器，点击右上角按钮添加</div>'
            return
        }

        userSSH_list.forEach((info) => {
            const dotColor = SERVER_COLORS[parseInt(info.color) || 0]
            const card = document.createElement('div')
            card.className = 'server-card'
            card.innerHTML = `
                <div class="server-card-dot" style="background:${dotColor};"></div>
                <div class="server-card-info">
                    <div class="server-card-label">${info.label}</div>
                    <div class="server-card-addr">${info.username}@${info.host}:${info.port}</div>
                </div>
                <span class="server-card-more" oncontextmenu="showHostMenu(${info.id})" onclick="event.stopPropagation();showHostMenu(${info.id})" title="更多">⋯</span>
            `
            card.onclick = () => goSSH(info.id)
            listEl.appendChild(card)
        })
    })
}

// ==================== 连接到 SSH ====================

function goSSH(id) {
    const userSSHInfo = userSSH_list[id]
    window.electronAPI.goSSH(userSSHInfo)
}

// ==================== 颜色选择 ====================

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

// ==================== 初始化 ====================

function initServers() {
    readConf((ok, conf) => {
        if (ok) userSSH_list = conf
        // 没有任何 SSH 连接时，显示服务器主页
        if (!userSSH_list || userSSH_list.length === 0) {
            showServerHome()
        }
    })
}

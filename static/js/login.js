var remote = require('electron').remote;
const node_ssh = require('node-ssh')

var userSSH_list = []

function show_dialog(isShow, title = '新建Host') {
    document.getElementById('dialog_title').innerHTML = title
    if (isShow) {
        document.getElementById('new_ssh_dialog').style.display = 'block'
        document.getElementById('host').focus()
    } else {
        //清空dialog
        setSSHDialogVal(null)
        document.getElementById('new_ssh_dialog').style.display = 'none'
    }

}

function saveUserSSHInfo(userSSHInfo) {
    //test ssh
    var ssh_test = new node_ssh()
    ssh_test.connect({
        host: userSSHInfo.host,
        username: userSSHInfo.username,
        password: userSSHInfo.password,
        privateKey: userSSHInfo.privateKey,
        port: userSSHInfo.port,
    }).then(() => {
        // edit
        if (userSSHInfo.id != -1) {
            console.log('edit', userSSHInfo.id)
            //refresh
            userSSH_list[userSSHInfo.id] = userSSHInfo
            //write to config
            writeConf(userSSH_list, (err) => {
                if (err) {
                    console.log(err)
                } else {
                    show_dialog(false)
                    //重载页面
                    loadConf()
                }
            })
            return
        }
        // add
        // ipcRenderer.send('add_userSSHInfo', userSSHInfo)
        readConf((ok, conf) => {
            if (ok) { //insert
                userSSHInfo.id = conf.length
                conf.push(userSSHInfo)
                // console.log(conf)
            } else { //first
                userSSHInfo.id = 0
                conf = [userSSHInfo]
            }
            //save to config file
            writeConf(conf, (err) => {
                if (err) {
                    console.log(err)
                } else {
                    //隐藏dialog
                    show_dialog(false)
                    //重载页面
                    loadConf()
                }
            })

        })

    }, function (error) {
        console.log(error)
        alert("连接失败")
    })
}

function addUserSSHInfo() {
    host = document.getElementById('host').value
    username = document.getElementById('username').value
    label = document.getElementById('label').value
    password = document.getElementById('password').value
    privateKey = document.getElementById('privateKey').value
    port = document.getElementById('port').value
    id = document.getElementById('id').value
    ssh = false

    if (host == "" || username == "" || (password == "" && privateKey == "")) {
        // show_dialog(false)
        alert('请正确输入必填项!')
        return
    }

    if (port == "") {
        port = 22
    }

    if (label == "") {
        label = username + '@' + host
    }

    if (privateKey != "") {
        ssh = true
    }

    var userSSHInfo = {
        id: id,
        host: host,
        username: username,
        password: password,
        ssh: ssh,
        privateKey: privateKey,
        characterSet: 'utf8',
        port: port,
        label: label,
        favourites: []
    }

    console.log('add userSSHInfo', userSSHInfo.id, userSSHInfo.label)
    //save to local
    saveUserSSHInfo(userSSHInfo)

}

function selectPK() {
    showOpenFileWin((ok, pkfile) => {
        if (ok) {
            console.log("select pk:", pkfile)
            document.getElementById('privateKey').value = pkfile
            //clean pwd
            document.getElementById('password').value = ''
        }
    })
}

{/* <div class="c-5">
<a class="box" href="index.html">ubuntu@shilizi.cn</a>
</div> */}

function loadConf() {
    list_html = document.getElementById('userSSH_list')
    list_html.innerHTML = ""
    readConf((ok, conf) => {
        if (ok) {
            //save to memory
            userSSH_list = conf
        }
        //else 没有配置文件，只显示添加按钮
        // console.log(conf)
        userSSH_list.forEach(userSSHInfo => {
            list_html.innerHTML += '<div class="c-2-5"><a class="box"  oncontextmenu="showHostMenu({0})" onclick="goSSH({1})">{2}<br><label>{3}@{4}</label></a></div>'.format(userSSHInfo.id, userSSHInfo.id, userSSHInfo.label, userSSHInfo.username, userSSHInfo.host)
        });
        // add button
        list_html.innerHTML += '<div class="c-2-5"><a class="box"  onclick="show_dialog(true)">+<br><label>Host</label></a></div>'
    })

}

function goSSH(id) {
    userSSHInfo = userSSH_list[id]
    console.log('go ssh', userSSHInfo.label)
    // ipcRenderer.send('go_ssh', userSSHInfo)
    // share data
    remote.getGlobal('shareData').userSSHInfo = userSSHInfo
    // to html
    window.location.href = 'index.html'
}

function delSSHInfo(id) {
    //删除
    userSSH_list.splice(id, 1)
    //更新id
    userSSH_list.forEach((userSSHInfo, i) => {
        userSSHInfo.id = i
        userSSH_list[i] = userSSHInfo
    })
    //保存
    writeConf(conf, (err) => {
        if (err) {
            console.log(err)
        } else {
            //重载页面
            loadConf()
        }
    })
}

function editSSHInfo(userSSHInfo) {
    setSSHDialogVal(userSSHInfo)
    //set title
    show_dialog(true, '编辑Host')
}

function setSSHDialogVal(userSSHInfo) {
    if (userSSHInfo) {
        document.getElementById('host').value = userSSHInfo.host
        document.getElementById('username').value = userSSHInfo.username
        document.getElementById('label').value = userSSHInfo.label
        document.getElementById('password').value = userSSHInfo.password
        document.getElementById('privateKey').value = userSSHInfo.privateKey
        document.getElementById('port').value = userSSHInfo.port
        document.getElementById('id').value = userSSHInfo.id
    } else {
        document.getElementById('host').value = ""
        document.getElementById('username').value = ""
        document.getElementById('label').value = ""
        document.getElementById('password').value = ""
        document.getElementById('privateKey').value = ""
        document.getElementById('port').value = 22
        document.getElementById('id').value = -1
    }
}

setTheme() //设置主题
// delConf()
loadConf()

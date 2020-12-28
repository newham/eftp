var remote = require('electron').remote;
const node_ssh = require('node-ssh')

var userSSH_list = []

var lock = false //打开编辑框后，其他图标click锁

var save_lock = false //保存、取消按钮锁

function show_dialog(isShow, title = '新建Host') {
    if (isShow) {
        document.getElementById('dialog_title').innerHTML = title //改变title
        lock = true //加锁
        document.getElementById('new_ssh_dialog').style.display = 'block'
        document.getElementById('username').focus()
    } else {
        if (save_lock) { //正在保存中，禁止取消dialog
            return
        }
        lock = false //关闭dialog显示锁
        document.getElementById('new_ssh_dialog').style.display = 'none'
    }
}

function new_ssh() {
    if (lock) {
        return false
    }
    //清空dialog
    setSSHDialogVal(null)
    show_dialog(true)
}

function saveUserSSHInfo(userSSHInfo) {
    // edit 直接覆盖原值，不进行测试
    if (userSSHInfo.id != -1) {
        console.log('edit', userSSHInfo.id)
            //refresh
        userSSH_list[userSSHInfo.id] = userSSHInfo
            //write to config
        writeConf(userSSH_list, (err) => {
            if (err) {
                console.log(err)
            } else {
                // show_dialog(false)
                //重载页面
                loadConf()
            }
        })
        show_dialog(false) //隐藏编辑框
        return
    }

    //隐藏编辑对话框
    // show_dialog(false)

    //显示加载的对话框
    document.getElementById('host_address').innerHTML = `${userSSHInfo.username}@${userSSHInfo.host}`
    show('loading_dialog', true)
    save_lock = true //为保存按钮加锁

    // add
    //1. test ssh
    var ssh_test = new node_ssh()
    ssh_test.connect({
        host: userSSHInfo.host,
        username: userSSHInfo.username,
        password: userSSHInfo.password,
        privateKey: userSSHInfo.privateKey,
        port: userSSHInfo.port,
    }).then(() => {
        // 这里是connect 成功
        show('loading_dialog', false) //隐藏连接测试loading框
        save_lock = false //保存锁解锁

        //2. 获取系统类型
        ssh_test.exec('uname', ['-s'], {
            onStdout(chunk) {
                let os_type = chunk.toString(userSSHInfo.characterSet).replace(/\n|\r/g, "") //！！！！注意去掉换行符

                if (!os_type in ['Darwin', 'Linux']) { //暂时不支持windows系统
                    alert(`暂时不支持连接到${os_type}系统！`)
                    return false
                }
                //set os type
                userSSHInfo.osType = os_type

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
                    //3. save to config file
                    writeConf(conf, (err) => {
                        if (err) {
                            console.log(err)
                        } else {
                            //隐藏dialog
                            // show_dialog(false)
                            //重载页面
                            loadConf()
                        }
                    })

                })
            },
            onStderr(chunk) {
                console.log('uname', chunk.toString(userSSHInfo.characterSet))
            }
        }).then(() => { //全部添加成功（connect成功，uname成功)
            show_dialog(false) //隐藏编辑框
        }).catch((res) => {
            console.log('uname', res)
        })


    }, function(error) { // connect 失败
        show('loading_dialog', false)
        save_lock = false //保存锁解锁
            // console.log(error)
        show_dialog(true, `<div class="txt-danger">连接失败: ${error}</div>`) //在编辑框中显示错误
    })
}

var tmp_favourites = []

function addUserSSHInfo() {
    if (save_lock) {
        return
    }
    host = document.getElementById('host').value
    username = document.getElementById('username').value
    label = document.getElementById('label').value
    password = document.getElementById('password').value
    privateKey = document.getElementById('privateKey').value
    port = document.getElementById('port').value
    id = document.getElementById('id').value
    color = document.getElementById('color').value
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
        favourites: tmp_favourites,
        color: color,
        osType: 'Linux',
    }

    console.log('add userSSHInfo', userSSHInfo.id, userSSHInfo.label)

    //save to local
    saveUserSSHInfo(userSSHInfo)
}

function selectPK() {
    if (lock) {
        return
    }
    showOpenFileWin((ok, pkfile) => {
        if (!ok) {
            return
        }
        console.log("select pk:", pkfile)
        document.getElementById('privateKey').value = pkfile
            //clean pwd
        document.getElementById('password').value = ''
    })
}

{
    /* <div class="c-5">
    <a class="box" href="index.html">ubuntu@shilizi.cn</a>
    </div> */
}

function loadConf() {
    list_html = document.getElementById('userSSH_list')
    list_html.innerHTML = ""
    readConf((ok, conf) => {
        if (ok) {
            //save to memory
            userSSH_list = conf
        }

        // console.log(conf)
        userSSH_list.forEach(userSSHInfo => {
            let icon = 'static/img/svg/os/icon-linux.svg'
            if (userSSHInfo.osType == 'Darwin') {
                icon = 'static/img/svg/os/icon-mac.svg'
            }
            list_html.insertAdjacentHTML('beforeend', `<div class="c-2-5"><a class="box bg-color-${userSSHInfo.color}"  oncontextmenu="showHostMenu(${userSSHInfo.id})" onclick="goSSH(${userSSHInfo.id})"><img src="${icon}">${userSSHInfo.label}<br><label>${userSSHInfo.username}@${userSSHInfo.host}</label></a></div>`)
        });

        // add button
        list_html.insertAdjacentHTML('beforeend', '<div class="c-2-5"><a class="box" onclick="new_ssh()">＋<br><label>New Host</label></a></div>')
    })

}

function goSSH(id) {
    if (lock) {
        return false
    }
    userSSHInfo = userSSH_list[id]
    console.log('go ssh', userSSHInfo.label)
    ipcRenderer.send('go_ssh', userSSHInfo)
        // share data
        // remote.getGlobal('shareData').userSSHInfo = userSSHInfo
        // to html
        // window.location.href = 'index.html'
}

function delSSHInfo(id) {
    if (lock) {
        return false
    }
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
    if (lock) {
        return false
    }
    setSSHDialogVal(userSSHInfo)
        //set tmp_favourites 
    tmp_favourites = userSSHInfo.favourites
        //set title
    show_dialog(true, '编辑Host')
}

function setSSHDialogVal(userSSHInfo) {
    color = Math.floor((Math.random() * 7))
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
    } else {
        document.getElementById('host').value = ""
        document.getElementById('username').value = ""
        document.getElementById('label').value = ""
        document.getElementById('password').value = ""
        document.getElementById('privateKey').value = ""
        document.getElementById('port').value = 22
        document.getElementById('id').value = -1
        document.getElementById('color').value = color
    }
    setColor(color)
}

function setColor(color = 0) {
    color_group = document.getElementById('color-group').children;
    for (i = 0; i < color_group.length; i++) {
        if (i == color) {
            color_group[i].classList.add('active')
            document.getElementById('color').value = color
        } else {
            color_group[i].classList.remove('active')
        }
    }
}

setTheme() //设置主题

// delConf() //删除配置（debug）

loadConf()
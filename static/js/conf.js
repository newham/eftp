// conf.js — 配置文件读写，通过 IPC 获取 userData 路径，使用 Node.js fs（在主进程侧）
// 注意：由于 contextIsolation=true、nodeIntegration=false，
//       渲染进程无法直接使用 fs，改为通过 IPC 让主进程处理文件读写。
//       此处使用 ipcRenderer invoke 形式进行同步风格的异步调用。

// ---- 获取配置文件路径 ----
let _confFile = null

async function getConfFile() {
    if (_confFile) return _confFile
    const userDataPath = await window.electronAPI.getUserDataPath()
    _confFile = userDataPath + '/' + 'eftp.json'
    return _confFile
}

// ---- 读取配置 ----
function readConf(f) {
    getConfFile().then((confFile) => {
        window.electronAPI.readFile(confFile).then((result) => {
            if (!result.ok) {
                console.log('readConf error:', result.error)
                f(false, null)
                return
            }
            try {
                const conf = JSON.parse(result.data)
                f(true, conf)
            } catch(e) {
                console.log('readConf parse error:', e)
                f(false, null)
            }
        })
    })
}

// ---- 写入配置 ----
function writeConf(confJson, f) {
    getConfFile().then((confFile) => {
        window.electronAPI.writeFile(confFile, JSON.stringify(confJson)).then((result) => {
            if (!result.ok) {
                console.log('writeConf error:', result.error)
                f(result.error)
            } else {
                f(null)
            }
        })
    })
}

// ---- 删除配置 ----
function delConf() {
    getConfFile().then((confFile) => {
        window.electronAPI.deleteFile(confFile).then(() => {})
    })
}

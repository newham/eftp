var remote = require('electron').remote;
const fs = require('fs');
const confFile = remote.app.getPath('userData') + '/' + 'eftp.json'

function readConf(f) {
    fs.readFile(confFile, (err, data) => {
        if (err) {
            console.log(err)
            f(false, null)
            return
        }
        // console.log('conf:', data.toString())
        conf = JSON.parse(data.toString())
        f(true, conf)
        return
    })
}

function writeConf(confJson, f) {
    fs.writeFile(confFile, JSON.stringify(confJson), (err) => {
        if (err) {
            console.log(err)
            f(err)
            return
        }
        f(null)
    })
}

function delConf() {
    try {
        fs.unlinkSync(confFile);
    } catch (e) {
        console.log(e)
    }
}
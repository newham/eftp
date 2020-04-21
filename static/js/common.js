var remote = require('electron').remote;

String.prototype.format = function () {
    if (arguments.length == 0) return this;
    for (var s = this, i = 0; i < arguments.length; i++)
        s = s.replace(new RegExp("\\{" + i + "\\}", "g"), arguments[i]);
    return s;
};

function setTheme() {
    theme = document.getElementById('theme-css')
    if (remote.getGlobal('shareData').isDark) {
        theme.href = 'static/css/dark.css'
    } else {
        theme.href = 'static/css/light.css'
    }
}

const { ipcRenderer } = require('electron')

ipcRenderer.on('themeChanged', (event, msg) => {
    console.log("themeChanged: isDark", msg)
    setTheme()
})

var max = false

function maxWindow() {
    if (!max) {
        remote.getCurrentWindow().maximize();
    } else {
        remote.getCurrentWindow().unmaximize();
    }
    max = !max;
}
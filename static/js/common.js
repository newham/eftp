var remote = require('electron').remote;

//请使用js原生的`${xxx}`方法代替
// String.prototype.format = function () {
//     if (arguments.length == 0) return this;
//     for (var s = this, i = 0; i < arguments.length; i++)
//         s = s.replace(new RegExp("\\{" + i + "\\}", "g"), arguments[i]);
//     return s;
// };

// String.prototype.endWith = function(str){
//     if(str==null || str=="" || this.length == 0 ||str.length > this.length){	
//       return false;
//     }
//     if(this.substring(this.length - str.length)){
//         return true;
//     }else{
//         return false;
//     }
//     return true;
// };

// String.prototype.startWith = function(str){
//  if(str == null || str== "" || this.length== 0 || str.length > this.length){
//     return false;
//  } 
//  if(this.substr(0,str.length) == str){
//     return true;
//  }else{
//     return false;
//   }       
//  return true; 
// };

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

function appenHTMLByID(id, html) {
    document.getElementById(id).insertAdjacentHTML('beforeend', html)
}

function setHTMLByID(id, html) {
    document.getElementById(id).innerHTML = html
}

function addClassByID(id, c) {
    document.getElementById(id).classList.add(c)
}

function delClassByID(id, c) {
    document.getElementById(id).classList.remove(c)
}

function show(id, isShow) {
    if (isShow) {
        document.getElementById(id).style.display = 'block'
    } else {
        document.getElementById(id).style.display = 'none'
    }
}
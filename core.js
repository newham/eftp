
const Client = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');

// 初始化SFTP客户端
const sftp = new Client();

const HOST = '10.10.156.118'
const PORT = '22'
const USERNAME = 'liuhan'
const PASSWORD = 'lh123'

async function uploadFileWithResume(localFilePath, remoteFilePath) {
    try {
        // 连接到SFTP服务器
        await sftp.connect({
            host: HOST,
            port: PORT,
            username: USERNAME,
            password: PASSWORD
        });

        // 获取本地文件的大小
        const localFileSize = fs.statSync(localFilePath).size;

        // 获取远程文件的大小
        let remoteFileSize = 0;
        try {
            const remoteFileStats = await sftp.stat(remoteFilePath);
            remoteFileSize = remoteFileStats.size;
            console.log(`Remote file size: ${remoteFileSize} bytes`);
        } catch (err) {
            console.log('Remote file does not exist. Starting from 0 bytes.');
        }

        // 如果本地文件大小小于等于远程文件，说明文件已完全上传
        if (remoteFileSize >= localFileSize) {
            console.log('File already fully uploaded.');
            return;
        }

        // 读取本地文件，从上次传输的偏移量开始
        const readStream = fs.createReadStream(localFilePath, {
            start: remoteFileSize
        });

        // // 使用 `fastPut` 实现断点续传
        // await sftp.fastPut(
        //     localFilePath,  // 本地文件路径
        //     remoteFilePath, // 远程文件路径
        //     {
        //         flags: 'a',    // 追加写入文件
        //         step: (totalTransferred, chunk, total) => {
        //             console.log(`Progress: ${totalTransferred} of ${total}`);
        //         },
        //         encoding: 'binary'
        //     }
        // );
        // 使用 sftp.put 实现断点续传
        let totalTransferred = remoteFileSize;

        // 监听 `data` 事件以更新进度
        readStream.on('data', (chunk) => {
            totalTransferred += chunk.length;
            const progress = ((totalTransferred / localFileSize) * 100).toFixed(2);
            process.stdout.write(`\r进度: ${progress}% (${totalTransferred} / ${localFileSize} bytes)`);
        });

        // 使用 sftp.append 实现断点续传
        await new Promise((resolve, reject) => {
            readStream.on('error', reject);

            // 创建写入流到远程文件
            sftp.append(readStream, remoteFilePath)
                .then(() => {
                    console.log('文件上传成功！');
                    resolve();
                })
                .catch((err) => {
                    console.error('上传时出错:', err);
                    reject(err);
                });
        });
        console.log('File uploaded successfully!');
    } catch (err) {
        console.error('Error during upload:', err);
    } finally {
        // 断开与SFTP服务器的连接
        await sftp.end();
    }
}

function uploadFileWithResume(localFilePath, remoteFilePath) {
    let abortFlag = false;
    let readStream;

    const abort = () => {
        console.log('\n上传已取消。');
        abortFlag = true;
        if (readStream) readStream.close(); // 关闭读取流以停止上传
        sftp.end(); // 断开SFTP连接
    };

    const uploadPromise = new Promise(async (resolve, reject) => {
        try {
            // 连接到SFTP服务器
            await sftp.connect({
                host: HOST,
                port: PORT,
                username: USERNAME,
                password: PASSWORD
            });

            // 获取本地文件的大小
            const localFileSize = fs.statSync(localFilePath).size;

            // 获取远程文件的大小
            let remoteFileSize = 0;
            try {
                const remoteFileStats = await sftp.stat(remoteFilePath);
                remoteFileSize = remoteFileStats.size;
                console.log(`远程文件大小: ${remoteFileSize} bytes`);
            } catch (err) {
                console.log('远程文件不存在，从头开始传输。');
            }

            // 如果本地文件大小小于等于远程文件，说明文件已完全上传
            if (remoteFileSize >= localFileSize) {
                console.log('文件已完全上传。');
                resolve();
                return;
            }

            // 从上次传输的偏移量开始读取本地文件
            readStream = fs.createReadStream(localFilePath, {
                start: remoteFileSize
            });

            let totalTransferred = remoteFileSize;

            // 监听 `data` 事件以更新进度
            readStream.on('data', (chunk) => {
                if (abortFlag) return; // 如果设置了取消标志，停止处理数据
                totalTransferred += chunk.length;
                const progress = ((totalTransferred / localFileSize) * 100).toFixed(2);
                process.stdout.write(`\r进度: ${progress}% (${totalTransferred} / ${localFileSize} bytes)`);
            });

            // 使用 sftp.append 实现断点续传，并支持取消
            await sftp.append(readStream, remoteFilePath)
                .then(() => {
                    if (!abortFlag) {
                        // console.log('\n文件上传成功！');
                        resolve();
                    }
                })
                .catch((err) => {
                    console.error('上传时出错:', err);
                    reject(err);
                });

        } catch (err) {
            console.error('上传过程中出错:', err);
            reject(err);
        } finally {
            // 确保在结束时断开连接
            await sftp.end();
        }
    });

    return { abort, promise: uploadPromise };
}

// 使用示例
const uploader = uploadFileWithResume(
    '/Users/liuhan/Downloads/zhaojinmai.safetensors',
    '/home/liuhan/Work/ai/stable-diffusion-webui/models/Lora/zhaojinmai.safetensors'
);

// 等待上传完成
uploader.promise
    .then(() => console.log('上传已完成或已取消'))
    .catch((err) => console.error('上传失败:', err));

// 5秒后手动取消
// setTimeout(() => {
//     uploader.abort();
// }, 5000);

// 使用函数进行文件上传并支持断点续传
// uploadFileWithResume(path.resolve(__dirname, 't.data'), '/home/liuhan/t.data');

// 定义下载文件函数，支持断点续传
function downloadFile(remoteFilePath, localFilePath) {
    let downloadCanceled = false; // 用于控制下载取消

    // 返回下载的 Promise 和取消函数
    const downloadPromise = new Promise(async (resolve, reject) => {
        try {
            // 连接到SFTP服务器
            await sftp.connect({
                host: HOST,
                port: PORT,
                username: USERNAME,
                password: PASSWORD
            });

            // 检查本地文件是否存在，如果存在则获取其大小以便断点续传
            let startByte = 0;
            let downloadedBytes = 0; // 已下载字节数
            if (fs.existsSync(localFilePath)) {
                const stats = fs.statSync(localFilePath);
                startByte = stats.size;
                downloadedBytes = startByte; // 初始化已下载字节数
            }

            // 获取远程文件的总大小
            const remoteFileInfo = await sftp.stat(remoteFilePath);
            const totalBytes = remoteFileInfo.size;

            // 创建读取流和写入流，设置 start 和 end 字节以实现断点续传
            const readStream = sftp.createReadStream(remoteFilePath, {
                start: startByte
            });
            const writeStream = fs.createWriteStream(localFilePath, { flags: 'a' });

            // 监听取消事件
            readStream.on('data', (chunk) => {
                if (downloadCanceled) {
                    console.log('手动停止');
                    readStream.destroy(); // 停止读取数据
                    sftp.end();
                    reject(new Error('下载已手动取消'));
                } else {
                    downloadedBytes += chunk.length;
                    process.stdout.write(`Downloaded: ${(downloadedBytes / totalBytes * 100).toFixed(2)}%\r`);
                }
            });

            // 监听错误和结束事件
            readStream.on('error', (err) => {
                console.error('下载失败:', err.message);
                sftp.end();
                reject(err);
            });

            readStream.on('end', () => {
                if (downloadCanceled) {
                    console.log('\n下载已手动取消');
                } else {
                    console.log('\n下载完成');
                    resolve();
                }
                sftp.end();
            });

            // 管道流数据
            readStream.pipe(writeStream);
        } catch (err) {
            console.error('连接或下载过程中出错:', err.message);
            reject(err);
        }
    });

    // 定义取消下载的函数
    function abort() {
        downloadCanceled = true;
        console.log('\n取消下载请求已发送...');
    }

    return { abort, promise: downloadPromise };
}

// 使用示例
// const downloader = downloadFile('/home/liuhan/t.data', './temp.data');

// // 开始下载并处理下载结果
// downloader.promise
//     .then(() => {
//         console.log('下载任务成功完成');
//     })
//     .catch((err) => {
//         console.error('下载任务失败:', err.message);
//     });

// // 在3秒后取消下载（示例）
// setTimeout(() => {
//     downloader.abort()
// }, 3000);
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 创建输出目录
const outputDir = path.join(__dirname, 'dist');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// 创建输出流
const output = fs.createWriteStream(path.join(outputDir, 'auto-play-video.zip'));
const archive = archiver('zip', {
    zlib: { level: 9 } // 设置压缩级别
});

// 监听完成事件
output.on('close', () => {
    console.log('打包完成！');
    console.log(`文件大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

// 添加文件
archive.pipe(output);

// 添加主要文件
archive.file('manifest.json', { name: 'manifest.json' });
archive.file('background.js', { name: 'background.js' });

// 添加目录
archive.directory('icons/', 'icons/');
archive.directory('popup/', 'popup/');
archive.directory('content/', 'content/');

// 完成打包
archive.finalize(); 

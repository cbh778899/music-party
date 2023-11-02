# 介绍 / Introduction
## CHN
和朋友们一起听自己上传的音乐吧！

## ENG
You can listen to musics uploaded by yourself with your friends!

# 运行 / Run
## CHN
1. 请在您的计算机里自行安装[FFmpeg](https://www.ffmpeg.org)
2. 请运行`npm install`来安装依赖
3. 通过`npm start`或`node server.js`运行
4. 默认端口为`3000`, 如有需要请新建`.env`文件并写入`PORT=<您要指定的端口>`

## ENG
1. Please install [FFmpeg](https://www.ffmpeg.org) in your PC
2. Please run `npm install` to install dependencies
3. Run `npm start` or `node server.js` to start
4. The default port is `3000`, if you need to change the port, please create a new file and specify your port as `PORT=<Your Port>`

# 版本 / Versions
**node**: v16.14.2  
**FFmpeg**: 2023-04-06-git-b564ad8eac-full

# 开发进度
**02/11/2023**  
- 同时使用hls.js和浏览器自身支持，现已支持大部分浏览器;  
- 添加toastify提示;  
- 添加查看房间成员功能;  
- 部分设备上标题显示不完整;  

**31/10/2023**  
- 完成基础框架;  
- 不支持HLS的浏览器暂时无法使用;  
- 账号管理功能开发中;
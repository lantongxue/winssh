# Changelog

## [1.1.3](https://github.com/lantongxue/winssh/compare/v1.1.2...v1.1.3) (2026-05-13)

### Features

* 添加SFTP并发上传下载、传输取消功能与配置项 ([8c7eed3](https://github.com/lantongxue/winssh/commit/8c7eed372db5a6ecfe250e03bafa6f421747f760))

## [1.1.2](https://cnb.cool/webqteam/winssh/compare/v1.1.1...v1.1.2) (2026-05-11)

### Bug Fixes

* 修复 SSH 会话重连入口 ([e4c0720](https://cnb.cool/webqteam/winssh/commit/e4c0720d1d7bab06497f4d31f6c164de575ef465))

## [1.1.1](https://cnb.cool/webqteam/winssh/compare/v1.2.0...v1.1.1) (2026-05-10)

# 更新日志

## [1.2.0](https://cnb.cool/webqteam/winssh/compare/v1.1.0...v1.2.0) (2026-05-10)

### ✨ 新功能

* logo换新 ([b24c9bc](https://cnb.cool/webqteam/winssh/commit/b24c9bcba3c90799b6022359390cd31f1651df0e))
* **sftp:** 支持递归下载远程目录并保留空文件夹 ([6550ef3](https://cnb.cool/webqteam/winssh/commit/6550ef3f53aec4fc66b9015a735dd214777d7606))



## 1.1.0 (2026-05-07)

### Features

* 更换字体逻辑，彻底移除使用系统字体的方式，改用内部集成 ([1cefa16](https://cnb.cool/webqteam/winssh/commit/1cefa16157159dcaf040f9354d3b7751d2f0a87d))
* 添加 xterm WebFonts 支持，改进webgl下对系统字体的渲染 ([5de3055](https://cnb.cool/webqteam/winssh/commit/5de30554a83fcb3ea3939c1829b29797529f4fe2))
* **图标:** 添加面板和侧边栏开关状态图标 ([08057c0](https://cnb.cool/webqteam/winssh/commit/08057c0404c4043c93688f29be83cc525cb5aa5b))
* **文件传输:** 添加批量文件上传进度跟踪功能 ([77d4a06](https://cnb.cool/webqteam/winssh/commit/77d4a06cc1fe78e6451c7ec40cf6ad15a657dd22))
* 在SFTP面板中显示文件修改时间 ([dc7c508](https://cnb.cool/webqteam/winssh/commit/dc7c50805267515a62c5590cb000cfe20cef436d))
* **主题:** 添加高对比度主题支持并优化主题系统 ([66126ed](https://cnb.cool/webqteam/winssh/commit/66126ed01ae8f5fc2c94a52c302be942296fb28b))
* **资源监控:** 添加资源监控间隔配置选项 ([105594f](https://cnb.cool/webqteam/winssh/commit/105594f8db9fb43f98469302229525bdb44dfe2e))
* add update center and update testing flow ([5f5eac9](https://cnb.cool/webqteam/winssh/commit/5f5eac9eb462cc7f13f78545bf33490656b6d9b5))
* **sftp:** 添加文件读取取消功能并优化编辑器加载体验 ([57a0fa8](https://cnb.cool/webqteam/winssh/commit/57a0fa8102e0439a10b1186a379f553f2d47faaf))
* **workbench:** 添加服务器地址和文件名称的国际化标签 ([a1e1ca5](https://cnb.cool/webqteam/winssh/commit/a1e1ca5ad8a90e3a4091f72ff87f8fbdc8386454))

### Bug Fixes

* 修复快速链接面板选择服务器时打开编辑器而非连接，以及关闭后输入未清空的问题 ([9c6474e](https://cnb.cool/webqteam/winssh/commit/9c6474e3618f66a848be4b91353c51a44716e6a4))
* 移除重复的数据库服务导入 ([b246353](https://cnb.cool/webqteam/winssh/commit/b246353bfd8462d37fd97b82052cc7a51c41e99f))

### Performance Improvements

* 优化 SFTP 面板小目录的滚动性能 ([323b6eb](https://cnb.cool/webqteam/winssh/commit/323b6eb8d04b72140c36ef7af966a2a709ecd391))
* 优化终端数据传输性能和 API 调用方式 ([4664e37](https://cnb.cool/webqteam/winssh/commit/4664e373fa2ddece6f37acc77f74740d0f404581))

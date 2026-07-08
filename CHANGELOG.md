# Changelog

## [1.2.3](https://github.com/lantongxue/winssh/compare/v1.2.2...v1.2.3) (2026-06-17)

### Features

- add incremental text decoder ([85c513d](https://github.com/lantongxue/winssh/commit/85c513db77ba1746ae91c302d1c627b66703f04b))
- add osc history worker dispatcher ([90f1b85](https://github.com/lantongxue/winssh/commit/90f1b8558f6328583fe83979418fb005ddef2ede))
- add port forward worker dispatcher ([4f7e1c2](https://github.com/lantongxue/winssh/commit/4f7e1c2620fe47ac0e4201dbf50b244aabcfb128))
- add preload binary channel ([92125e8](https://github.com/lantongxue/winssh/commit/92125e8d3fa44623d1e0c82dfd864cdb2fbe082b))
- add sftp worker dispatcher ([fae2ecc](https://github.com/lantongxue/winssh/commit/fae2ecc220c7bc24218655843804d33848017029))
- add ssh core worker skeleton ([f1a1f0f](https://github.com/lantongxue/winssh/commit/f1a1f0ff7b566931d1871553afad1f6bcb83250a))
- add ssh data aggregator ([9d41949](https://github.com/lantongxue/winssh/commit/9d419499d3caab70c53fcba2f1cce12df3d6e6a4))
- add ssh terminal data frame codec ([bd17280](https://github.com/lantongxue/winssh/commit/bd17280a660e687166c62b36ad95a4ede5777962))
- add ssh terminal web worker ([53be6ca](https://github.com/lantongxue/winssh/commit/53be6ca216fdd019e720b2bfa549c44fec062873))
- add ssh worker control port ([518fb31](https://github.com/lantongxue/winssh/commit/518fb31b95fcdff95ba1903fdde123c874ccc665))
- add ssh worker protocol baseline ([4de6e1b](https://github.com/lantongxue/winssh/commit/4de6e1bf4946317cc5d8c95bdeac4f494e910054))
- add terminal worker host ([e05d668](https://github.com/lantongxue/winssh/commit/e05d6685d32275dc3c49f2b9bd38a279d49597e9))
- add terminal worker protocol and isolation headers ([5089479](https://github.com/lantongxue/winssh/commit/5089479f5c191d8b4a02e21198a02be5f09d1d66))
- add worker supervisor service ([0ed358b](https://github.com/lantongxue/winssh/commit/0ed358bd405147f2edbee357888d42cedec72072))
- define sftp file stream api ([5b29811](https://github.com/lantongxue/winssh/commit/5b298116a1347a1153e79c13f427f529017301b2))
- expand ssh worker connection protocol ([6b40940](https://github.com/lantongxue/winssh/commit/6b40940a318ff18aef431816e5b012dc0be48464))
- expose ssh terminal data channel ([8b40bde](https://github.com/lantongxue/winssh/commit/8b40bde298590c7252d80ab278131040ea5b38b2))
- move host trust checks behind worker ([5311368](https://github.com/lantongxue/winssh/commit/5311368983c1edb563005d7f1ce829237e108e87))
- move resource snapshot behind worker ([6c15155](https://github.com/lantongxue/winssh/commit/6c151557cbcd3ba0f6dccf98c154596109ed6174))
- route ssh sessions through worker runtime ([2963c39](https://github.com/lantongxue/winssh/commit/2963c39523979a420687fe0f608de8b9cae3419f))
- route ssh terminal rendering through worker host ([896a512](https://github.com/lantongxue/winssh/commit/896a51296dcf5e1c4eade12c781ef8be7490e104))
- route ssh worker data through message ports ([026973c](https://github.com/lantongxue/winssh/commit/026973c084914e81eb2a3831ec26ba33f10084b3))
- **shell:** 优化 shell 集成安装与命令捕获 ([4304167](https://github.com/lantongxue/winssh/commit/4304167390306cc58758426e210a6d7ef44d107e))
- stream sftp file editor in renderer ([c6343dd](https://github.com/lantongxue/winssh/commit/c6343dd2249d550bc77384d689994f9aad703cdb))
- stream sftp file editor ipc in main ([6077d5e](https://github.com/lantongxue/winssh/commit/6077d5ef7d2b52ab4aefc372e58e650e0e12e81b))
- 增加ctrl + "+" / "-" / "0" 快捷键调整终端字体大小 ([08d80b8](https://github.com/lantongxue/winssh/commit/08d80b86c78e0ec6a23cb9c007571a38509ce326))
- 支持ctrl+鼠标滚动调整终端字体大小 ([ac3c1eb](https://github.com/lantongxue/winssh/commit/ac3c1ebacca775b23aa1cee5ca150d27940cdab8))

### Bug Fixes

- avoid sftp load chunk concatenation ([fa6da4a](https://github.com/lantongxue/winssh/commit/fa6da4a50dbb25aee9bbff30fed5e78b9a8277cb))
- cancel pending sftp editor read stream ([b224ff2](https://github.com/lantongxue/winssh/commit/b224ff2e70b73b13dd715b4e628e95579bd0b462))
- harden sftp file stream runtime ([bfd7f13](https://github.com/lantongxue/winssh/commit/bfd7f1367a81e937a94baba30ee754e9f58bbbc8))
- harden sftp read stream lifecycle ([2060168](https://github.com/lantongxue/winssh/commit/2060168e478b74932b7b8b9bf6c323e6259d8876))
- harden sftp stream edge cases ([093760f](https://github.com/lantongxue/winssh/commit/093760f45361cd15fe0cf0ca7c2f06b51695b370))
- harden sftp streaming follow-ups ([1b0c609](https://github.com/lantongxue/winssh/commit/1b0c609aed3bd92dc3a3745958bc9343be82efe3))
- ignore stale worker read stream starts ([a7fee3e](https://github.com/lantongxue/winssh/commit/a7fee3e5b566200c4dd72690749f65af3cd322ba))
- order sftp stream events after open ack ([86a25e0](https://github.com/lantongxue/winssh/commit/86a25e06de4ecf6911f94ceefa5295346de26e02))
- preserve smart decode utf8 detection ([562ec2c](https://github.com/lantongxue/winssh/commit/562ec2cbb247fcdbd6ca916a34076f0eddeea66b))
- preserve split surrogate sftp writes ([cb6acf8](https://github.com/lantongxue/winssh/commit/cb6acf88b47d9e0e067f580c659b9598db8524b7))
- prevent saving failed sftp editor loads ([4711184](https://github.com/lantongxue/winssh/commit/4711184dcec78a4eb5a4c9dad86dd4db32031cbc))
- show sftp editor stream progress ([82a5ec5](https://github.com/lantongxue/winssh/commit/82a5ec53cf0dca9255dd7c0646a4252c144b3c2c))
- stream sftp files through ssh worker ([005b386](https://github.com/lantongxue/winssh/commit/005b386445c2a032dd5e005abeef4d6930e6ab33))
- 修复编辑器不支持ctrl+鼠标滚动调整字体大小的问题 ([c7e483d](https://github.com/lantongxue/winssh/commit/c7e483d4bea04a98a3a3e259edc800344c1842f0))
- 修复资源监控骨架没对齐的问题 ([812cf02](https://github.com/lantongxue/winssh/commit/812cf0248ae07936559bc00ccabc629f16699e82))
- **服务器编辑器:** 调整编辑页字段分组 ([4b5ef3d](https://github.com/lantongxue/winssh/commit/4b5ef3db4a2d64f506a3610027f147aaa2d63ee9))
- 移除官网的部分交互动画，提升浏览器渲染性能 ([defadc1](https://github.com/lantongxue/winssh/commit/defadc1377ba5cc306d26543b01bd60f77b21d07))

## [1.2.2](https://github.com/lantongxue/winssh/compare/v1.2.1...v1.2.2) (2026-06-07)

### Features

- 增加 SFTP 目录跟随功能 ([b5c890c](https://github.com/lantongxue/winssh/commit/b5c890c021d024a1f6a6e4edb91141ee5ff6ef58))

## [1.2.1](https://cnb.cool/webqteam/winssh/compare/v1.2.0...v1.2.1) (2026-06-04)

### Bug Fixes

- 增加更新日志富文本渲染 ([4360c49](https://cnb.cool/webqteam/winssh/commit/4360c4984264e5cfecc11e1c3d7af3b05e9aa5ac))
- update website ([2f6ce0c](https://cnb.cool/webqteam/winssh/commit/2f6ce0cc39ad8d2ed8cf9a0db85e954dd72528c4))

## [1.2.0](https://github.com/lantongxue/winssh/compare/v1.1.12...v1.2.0) (2026-06-04)

### Features

- 全新官网 ([398417f](https://github.com/lantongxue/winssh/commit/398417f46cb7062660fa072e59b6f0c98c2979e7))
- 命令版本改为分页滚动，去掉虚拟滚动 ([fc39e0d](https://github.com/lantongxue/winssh/commit/fc39e0df4ad39fb76d16d7ca4f1b896f24edae10))
- 增加启用历史命令记录shell脚本注入提示 ([04a4c5e](https://github.com/lantongxue/winssh/commit/04a4c5ec9c755131debebccb8a5ff53f453f3f12))
- 增加目录收藏功能 ([7f94480](https://github.com/lantongxue/winssh/commit/7f94480f86132ea767a420feb84aa71563c8abc8))

### Bug Fixes

- 优化更新逻辑 ([c812761](https://github.com/lantongxue/winssh/commit/c8127619e91d289623e7b76375ba800c1155b422))
- 优化自动更新逻辑 ([664d668](https://github.com/lantongxue/winssh/commit/664d668deb5d63512c3a996439ea52a4439b870b))
- 使用github托管更新 ([38821b7](https://github.com/lantongxue/winssh/commit/38821b7433441ba8e9cd7c994a83f95c4dede6c5))
- 修复离开提醒时仍可以输入命令的bug ([b541f2e](https://github.com/lantongxue/winssh/commit/b541f2e0ce860b1ada34d51da5bdeade44a33a88))
- 修复编辑器缩进对齐的问题 ([c47a81e](https://github.com/lantongxue/winssh/commit/c47a81e20b0e87d265d856353f519be08aae9265))
- 修复记录历史命令中执行路径不对的问题（OSC脚本的问题） ([119a4bf](https://github.com/lantongxue/winssh/commit/119a4bf03901338c3d1e3d455891f8273ea6e947))
- 增加分组文件夹icon，改进修改分组逻辑 ([4d3c418](https://github.com/lantongxue/winssh/commit/4d3c4181eb56fe7a05ef7f227d877bea67d68d0f))
- 统一输入框的激活样式 ([f176927](https://github.com/lantongxue/winssh/commit/f1769278cdfab0080e43e608cfc5dceb83255ace))

## [1.1.12](https://github.com/lantongxue/winssh/compare/v1.1.11...v1.1.12) (2026-05-30)

### Features

- 增加快速切换主题 ([af71307](https://github.com/lantongxue/winssh/commit/af71307084c6b87576eaf7366d1452c803f92fab))

### Bug Fixes

- 优化端口转发面板 UI 和命令面板 UI ([8de3fa7](https://github.com/lantongxue/winssh/commit/8de3fa7bcc18425b2cd3e2c07f6f659c294e75b8))

## [1.1.11](https://cnb.cool/webqteam/winssh/compare/v1.1.10...v1.1.11) (2026-05-28)

### Features

- 移除旧版官网，增加全新官网 ([dbecb40](https://cnb.cool/webqteam/winssh/commit/dbecb40c78fdccfe5716cd7e800b4a3a89592da6))
- 增加命令面板原型设计 ([4aa76fc](https://cnb.cool/webqteam/winssh/commit/4aa76fc5bfe0583ba84a6a89bd3f4ea146f46b1c))
- 重写命令面板 ([183e440](https://cnb.cool/webqteam/winssh/commit/183e440945fc791d129fa979fde92e75aa6f31f9))
- 重新优化面板UI设计 ([8faf9e1](https://cnb.cool/webqteam/winssh/commit/8faf9e1b0b1980937c39fd93ffbda56e412849d9))
- redesign command panel with custom commands and workbench styling ([0496a77](https://cnb.cool/webqteam/winssh/commit/0496a77a6477eb9b80dd085c3b0aec02f22e6066))
- **security:** add away reminder safety overlay ([174e528](https://cnb.cool/webqteam/winssh/commit/174e528e369205acf245a06a5f33c9545fbbc954))

### Bug Fixes

- 优化sftp跳转不跟手的问题 ([7538119](https://cnb.cool/webqteam/winssh/commit/753811982a64104ad02c73359806332a705f246a))

## [1.1.10](https://github.com/lantongxue/winssh/compare/v1.1.9...v1.1.10) (2026-05-25)

## [1.1.9](https://cnb.cool/webqteam/winssh/compare/v1.1.8...v1.1.9) (2026-05-25)

### Features

- 跨平台资源监控、主机指纹对话框迁移渲染端、命令历史面板升级、SFTP智能编码 ([3742278](https://cnb.cool/webqteam/winssh/commit/3742278a1422277d7f0a14c67afb00ac4bdac4ad))

## [1.1.8](https://cnb.cool/webqteam/winssh/compare/v1.1.7...v1.1.8) (2026-05-25)

### Features

- 移除终端跟随功能 ([a4f92fe](https://cnb.cool/webqteam/winssh/commit/a4f92fe1ccb7e9c22ad4fde8b1a3724b5864e00f))
- 增加命令历史记录 ([ef27a34](https://cnb.cool/webqteam/winssh/commit/ef27a3499e4c3d09f9da9e52ccb9dac01e8c1e9c))
- 增加全新的官网 ([adcef8c](https://cnb.cool/webqteam/winssh/commit/adcef8ce7c6ab79da9c5e8caf70a86d03c6f879e))
- **session:** 添加 OSC 7 目录检测功能并推送 cwd 事件 ([5011114](https://cnb.cool/webqteam/winssh/commit/5011114fd508e0e3a531bd5e376a825f7fe2ab48))

## [1.1.7](https://cnb.cool/webqteam/winssh/compare/v1.1.6...v1.1.7) (2026-05-18)

### Features

- **terminal:** 终端超链接支持 Ctrl/Cmd+click 打开 ([962f62c](https://cnb.cool/webqteam/winssh/commit/962f62ca1fa45c91c1f33fcd4afa29b7e1a282a6))

## [1.1.6](https://cnb.cool/webqteam/winssh/compare/v1.1.5...v1.1.6) (2026-05-18)

### Features

- **workbench:** 服务器管理节点新增下拉菜单 ([d15be2d](https://cnb.cool/webqteam/winssh/commit/d15be2d9cd43a0329524824ff455fa05df966c46))

## [1.1.5](https://github.com/lantongxue/winssh/compare/v1.1.3...v1.1.5) (2026-05-18)

### Features

- **sftp:** add file/directory move functionality ([dae0cd1](https://github.com/lantongxue/winssh/commit/dae0cd166006636f698af7afd969c5501cc877d1))
- **workbench:** add global sftp panel side setting ([4a35c7e](https://github.com/lantongxue/winssh/commit/4a35c7e1401ce2d4cee77ec84774fd4040acc54e))
- **workbench:** 支持拖拽调整SFTP面板显示侧边 ([45dc537](https://github.com/lantongxue/winssh/commit/45dc537cf4c21a41918ca9f3cafc01661b7cf782))
- 增加 SFTP树形结构视图，增加 macos 识别 ([7dd7867](https://github.com/lantongxue/winssh/commit/7dd786731b96c63bc41164d03c72be2b58d514be))
- 新增服务器查询接口，重构SFTP面板上下文菜单 ([23a42f0](https://github.com/lantongxue/winssh/commit/23a42f09b18314b033683d88357b975a931f632b))

### Bug Fixes

- 服务器节点默认全部展开 ([d2de630](https://github.com/lantongxue/winssh/commit/d2de630d700386cd8b66a115d56460caa169dd8f))

## [1.1.4](https://cnb.cool/webqteam/winssh/compare/v1.1.3...v1.1.4) (2026-05-18)

### Features

- 新增服务器查询接口，重构SFTP面板上下文菜单 ([23a42f0](https://cnb.cool/webqteam/winssh/commit/23a42f09b18314b033683d88357b975a931f632b))
- 增加 SFTP树形结构视图，增加 macos 识别 ([7dd7867](https://cnb.cool/webqteam/winssh/commit/7dd786731b96c63bc41164d03c72be2b58d514be))
- **sftp:** add file/directory move functionality ([dae0cd1](https://cnb.cool/webqteam/winssh/commit/dae0cd166006636f698af7afd969c5501cc877d1))
- **workbench:** 支持拖拽调整SFTP面板显示侧边 ([45dc537](https://cnb.cool/webqteam/winssh/commit/45dc537cf4c21a41918ca9f3cafc01661b7cf782))
- **workbench:** add global sftp panel side setting ([4a35c7e](https://cnb.cool/webqteam/winssh/commit/4a35c7e1401ce2d4cee77ec84774fd4040acc54e))

### Bug Fixes

- 服务器节点默认全部展开 ([d2de630](https://cnb.cool/webqteam/winssh/commit/d2de630d700386cd8b66a115d56460caa169dd8f))

## [1.1.3](https://github.com/lantongxue/winssh/compare/v1.1.2...v1.1.3) (2026-05-13)

### Features

- 添加SFTP并发上传下载、传输取消功能与配置项 ([8c7eed3](https://github.com/lantongxue/winssh/commit/8c7eed372db5a6ecfe250e03bafa6f421747f760))

## [1.1.2](https://cnb.cool/webqteam/winssh/compare/v1.1.1...v1.1.2) (2026-05-11)

### Bug Fixes

- 修复 SSH 会话重连入口 ([e4c0720](https://cnb.cool/webqteam/winssh/commit/e4c0720d1d7bab06497f4d31f6c164de575ef465))

## [1.1.1](https://cnb.cool/webqteam/winssh/compare/v1.2.0...v1.1.1) (2026-05-10)

# 更新日志

## [1.2.0](https://cnb.cool/webqteam/winssh/compare/v1.1.0...v1.2.0) (2026-05-10)

### ✨ 新功能

- logo换新 ([b24c9bc](https://cnb.cool/webqteam/winssh/commit/b24c9bcba3c90799b6022359390cd31f1651df0e))
- **sftp:** 支持递归下载远程目录并保留空文件夹 ([6550ef3](https://cnb.cool/webqteam/winssh/commit/6550ef3f53aec4fc66b9015a735dd214777d7606))

## 1.1.0 (2026-05-07)

### Features

- 更换字体逻辑，彻底移除使用系统字体的方式，改用内部集成 ([1cefa16](https://cnb.cool/webqteam/winssh/commit/1cefa16157159dcaf040f9354d3b7751d2f0a87d))
- 添加 xterm WebFonts 支持，改进webgl下对系统字体的渲染 ([5de3055](https://cnb.cool/webqteam/winssh/commit/5de30554a83fcb3ea3939c1829b29797529f4fe2))
- **图标:** 添加面板和侧边栏开关状态图标 ([08057c0](https://cnb.cool/webqteam/winssh/commit/08057c0404c4043c93688f29be83cc525cb5aa5b))
- **文件传输:** 添加批量文件上传进度跟踪功能 ([77d4a06](https://cnb.cool/webqteam/winssh/commit/77d4a06cc1fe78e6451c7ec40cf6ad15a657dd22))
- 在SFTP面板中显示文件修改时间 ([dc7c508](https://cnb.cool/webqteam/winssh/commit/dc7c50805267515a62c5590cb000cfe20cef436d))
- **主题:** 添加高对比度主题支持并优化主题系统 ([66126ed](https://cnb.cool/webqteam/winssh/commit/66126ed01ae8f5fc2c94a52c302be942296fb28b))
- **资源监控:** 添加资源监控间隔配置选项 ([105594f](https://cnb.cool/webqteam/winssh/commit/105594f8db9fb43f98469302229525bdb44dfe2e))
- add update center and update testing flow ([5f5eac9](https://cnb.cool/webqteam/winssh/commit/5f5eac9eb462cc7f13f78545bf33490656b6d9b5))
- **sftp:** 添加文件读取取消功能并优化编辑器加载体验 ([57a0fa8](https://cnb.cool/webqteam/winssh/commit/57a0fa8102e0439a10b1186a379f553f2d47faaf))
- **workbench:** 添加服务器地址和文件名称的国际化标签 ([a1e1ca5](https://cnb.cool/webqteam/winssh/commit/a1e1ca5ad8a90e3a4091f72ff87f8fbdc8386454))

### Bug Fixes

- 修复快速链接面板选择服务器时打开编辑器而非连接，以及关闭后输入未清空的问题 ([9c6474e](https://cnb.cool/webqteam/winssh/commit/9c6474e3618f66a848be4b91353c51a44716e6a4))
- 移除重复的数据库服务导入 ([b246353](https://cnb.cool/webqteam/winssh/commit/b246353bfd8462d37fd97b82052cc7a51c41e99f))

### Performance Improvements

- 优化 SFTP 面板小目录的滚动性能 ([323b6eb](https://cnb.cool/webqteam/winssh/commit/323b6eb8d04b72140c36ef7af966a2a709ecd391))
- 优化终端数据传输性能和 API 调用方式 ([4664e37](https://cnb.cool/webqteam/winssh/commit/4664e373fa2ddece6f37acc77f74740d0f404581))

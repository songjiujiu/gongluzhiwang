# 侧边栏复访接入

首页底部提供“侧边栏再来玩”。点击后显示可关闭的三步引导，再由玩家主动点击“去首页侧边栏”跳转；不自动跳走，不承诺奖励。

`src/sidebar.js` 使用 `tt.checkScene({scene:'sidebar'})` 判断支持情况，使用实际 `tt.navigateToScene({scene:'sidebar'})` 调用跳转。API 缺失、检测失败或不支持时隐藏入口；跳转失败提示重试。`src/platform.js` 在启动时同步监听 `onShow`，按最新 `launch_from=homepage` 与 `location=sidebar_card` 识别返回，保留原前后台暂停处理。

验证：Node 覆盖能力检测、显式点击跳转、重复点击保护、失败与异常、冷/热启动来源；`node tools/verify_sidebar_preview.cjs` 覆盖 390×844 和 320×568 的入口、引导关闭、失败重试、成功跳转回调与开始游戏。浏览器采用模拟宿主接口，不能代替实际开发者工具预检或真机侧边栏跳转。

开发者工具重新编译 `公路之王` 目录，首页点击入口测试跳转，再上传新版本。可以使用启动场景 `021036` 模拟侧边栏进入；未上线游戏的真机侧边栏可见性以平台测试规则为准。若仍提示预检失败，保留完整错误信息排查其他失败项。

官方依据（2026-10-10 核验）：
- [上传提审与必接能力检测](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/mini-app-developer-instrument)
- [侧边栏技术指南](https://partner.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/open-ability/Introduction-for-tech)

# 驾考宝典之公路日常 · 无尽公路

当前版本为 **抖音原生 JavaScript + WebGL 三维场景 / Canvas 界面单关无尽驾驶小游戏**。取消选关与 75 秒终点，自动巡航越来越快，路障和车流逐渐密集，耐久耗尽后结算并挑战最高纪录。

车辆、路障及棕榈使用 **Blender 真实网格**，由 WebGL 实时绘制。道路、护栏、山体、海面与主车共用低机位跟车透视；界面仍由 Canvas 绘制。可编辑模型与美术脚本位于 `art/blender/` 和 `tools/blender/`。

实际游戏截图见 `research/blender-preview/realtime-game-390x844.png`。独立 Blender 展示图不代表游戏效果；实时材质仍与参考效果图有差异，尚未达到照片级渲染。

请在抖音开发者工具中导入 **`公路之王/` 子目录**，入口为 `公路之王/game.js`。

- [导入、操作与验证说明](公路之王/README.md)
- [无尽模式规则与难度设计](docs/endless-mode.md)
- [Blender 模型、素材与重渲染说明](docs/blender-art.md)
- [原始视频题材与旧版策划](docs/game-design.md)（旧三关规则已被无尽模式替代）

项目保留原有 AppID `tt9b11edac056834d607`。当前无尽版本的验证范围见子目录 README；原三关版本的模拟器记录不能视为本次验证。尚未上传、审核或发布。

在本目录运行逻辑与平台适配测试：

```powershell
node --test tests/*.test.js
```

打开浏览器本地预览：

```powershell
node preview/serve.js 4179
```

然后访问 [http://127.0.0.1:4179/](http://127.0.0.1:4179/)。预览使用同一份游戏逻辑和 Canvas 界面源码；浏览器验证不能代替抖音真机验证。若该端口的预览已运行，直接打开地址即可。

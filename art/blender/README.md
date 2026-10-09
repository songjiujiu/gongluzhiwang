# 公路之王 · Blender 3D 视觉资产

这套素材由 Blender 5.2.1 LTS 实际建模并使用 Cycles 渲染。车辆、棕榈树、岩石和施工路障均为项目内 Python 脚本构建的原创网格，无需下载模型或外部贴图。

- `roadking-assets.blend`：完整可编辑模型、材质、灯光和展示相机。四辆车及三种道具按组排列在同一场景中。
- `showcase.png`：全部模型的工作室展示渲染。
- `manifest.json`：游戏 PNG 的尺寸、前进方向、投影范围和接地锚点。
- `../../公路之王/assets/blender/`：游戏使用的 8 张透明 PNG 及相同 manifest。
- `../../tools/blender/build_assets.py`：可复现的建模与渲染脚本。

## 视觉设计

v3 同步更新首页 `hero.png` 和实时玩家网格：加宽后轮拱、收窄车身腰线、拉长拱形车顶，将闭合椭圆灯管改成开放式薄片 LED 灯组，并用贴合式面板重建尾翼。当前造型以 `roadking-assets.blend`、`showcase.png` 和实际首页截图为准；独立海岸展示图仍保留 v2 版本。

v2 根据 `reference-v2.png` 重新构建青绿色流线轿跑、银灰 SUV 和橙色轿车。玩家车使用连续曲面车身、真实轮拱开口、烟黑玻璃、贴合式窗柱、小尾翼、多辐轮毂、贯穿尾灯、扩散器和椭圆排气口，取消旧版白色条纹和高尾翼。施工路障改为橙白双层警示板和混凝土底座，棕榈叶使用曲面与羽状叶片。

`reference-scene.blend` 和 `reference-scene.png` 是同一组模型的独立 Blender 海岸场景和渲染。车辆细节脚本为 `../../tools/blender/reference_models.py`，海岸展示脚本为 `../../tools/blender/render_reference_scene.py`。它们是依据单张生成参考图的三维重建，隐藏结构为建模推断，与参考图并非完全一致。

当前游戏改为 WebGL 实时三维渲染，实际游戏截图见 `../../research/blender-preview/realtime-game-390x844.png`，不以独立 Cycles 展示图代替游戏效果。`../../tools/blender/export_runtime_meshes.py` 导出约 2.2 MB 的量化网格与材质分组，文件位于 `../../公路之王/assets/scene/`。道路、护栏、山体、海面和车辆使用统一透视；Canvas 用于 HUD 和合成。

## 重建

在项目根目录执行：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 6 --python tools\blender\build_assets.py
```

仅重渲染指定资产：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 6 --python tools\blender\build_assets.py -- --only car-player,hero,showcase
```

兼容 PNG 渲染使用 CPU、6 线程、AgX 色彩变换以及 Cycles 降噪，沿用正后上方正交投影和 Blender `+Y` 前向。菜单 `hero.png` 为同一辆完整 3D 模型的斜后方视角。实时网格转换为 X 右、Y 上、-Z 前向，使用透视跟车镜头和运行时阴影。

所有 sprite 的接地锚点为归一化坐标 `[0.5, 0.92]`。绘制时可令 PNG 的该点与游戏对象地面位置重合。`contentProjection` 是几何投影范围；抗锯齿后的实际 alpha 范围可能相差少量像素。

Blender 打开完整源文件后，可以在 Outliner 中分别编辑 `01 / LAGOON GT` 至 `07 / Sandstone verge rocks` 各组。`SHOWCASE camera framing helpers` 同时链接这些对象，便于整体构图；这些是相同对象的集合链接，不是重复网格。

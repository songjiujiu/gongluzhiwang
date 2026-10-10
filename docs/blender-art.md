# Blender 美术资源与游戏接入

## 交付结构

- `art/blender/roadking-assets.blend`：可编辑的 Blender 模型、材质、灯光和相机。
- `art/blender/showcase.png`：Blender 模型展示渲染。
- `tools/blender/build_assets.py`：可复现的建模与渲染脚本。
- `公路之王/assets/blender/`：游戏直接使用的透明 PNG 资源。
- `research/blender-preview/`：实际浏览器游戏截图与验证记录。

美术采用金属车漆、深色玻璃、轮胎轮毂与灯组细节，搭配暖色光照和海岸公路。玩家车保持青色，威胁车保持橙色，以便高速下识别；施工路障保留醒目的条纹。

## 参考图重建 v2

`art/blender/reference-v2.png` 是用户选定的生成参考图。v2 重新构建连续曲面的车身、真实轮拱开口、流线玻璃舱、贴合式窗柱、金属车漆、多辐轮毂、贯穿尾灯、小尾翼、扩散器与椭圆排气口，取消旧版白色赛车条纹和高尾翼。银灰 SUV 和橙色轿车同步调整，施工路障改为橙白双层警示板与混凝土底座，棕榈增加细分叶面与羽状叶片。

车辆控制网格和细节由 `tools/blender/reference_models.py` 构建，主脚本保留材质、灯光、渲染与资源锚点。`art/blender/reference-scene.blend` 和 `reference-scene.png` 是使用同一组实际模型制作的海岸场景与渲染，可通过 `tools/blender/render_reference_scene.py` 重建。场景中的道路、海面、山石和护栏都是 Blender 几何与程序材质。

这是根据单张参考图进行的可编辑三维重建，不是逐像素复制。参考图没有尺寸与其他角度信息，隐藏表面由建模推断；车型轮廓、灯组及实时材质仍与生成参考存在差异。海岸场景独立展示渲染不作为游戏效果的验收依据。

## 渲染方式

当前为 **实时 WebGL 三维场景**。`tools/blender/export_runtime_meshes.py` 将完整模型的 evaluated 网格简化并导出为 `公路之王/assets/scene/meshes.json` 和 `meshes.bin`，保留平滑法线和材质分组。运行时使用低机位跟车镜头、深度测试、道路纹理、车漆环境反射、阴影、海面和雾效，所有物体共用三维坐标。Canvas 只负责菜单、HUD 和触控界面，并合成离屏 WebGL 画布。

网格采用 16 位坐标与法线量化，运行时二进制约 2.2 MB，不需要安装 Blender、访问 CDN 或加载 `.blend`。原生平台使用第二个 `tt.createCanvas()` 建立离屏 WebGL 画布，通过本地文件系统读取网格；浏览器使用同一渲染模块。PNG 保留给菜单与兼容后备画面。WebGL 加载失败会明确显示“画面加载失败 · 请重新编译”，不能把后备画面当作三维版本验收。

完整模型重建后，另执行 `blender --background --python tools/blender/export_runtime_meshes.py` 更新运行时网格。`research/blender-preview/realtime-ui-smoke.json` 和 `realtime-game-*.png` 是实际游戏浏览器验证。实时材质不是 Cycles 光线追踪，手机的性能与离屏合成兼容性尚未验证。

## 素材用途

| 文件 | 内容 | 用途 |
| --- | --- | --- |
| `car-player.png` | 青色跑车 | 玩家驾驶车辆 |
| `car-silver.png` | 银灰 SUV | 普通车流 |
| `car-blue.png` | 蓝色轿车 | 普通车流 |
| `car-orange.png` | 橙色轿车 | 提前预告变线的威胁车 |
| `barrier.png` | 实体施工路障 | 固定障碍，仍需换道绕行 |
| `tree.png` | 树木模型 | 路边景观 |
| `rock.png` | 岩石模型 | 路边景观 |
| `hero.png` | 青色车三分之四视图 | 主菜单展示 |

原生平台通过 `tt.createImage()` 加载项目内资源；浏览器预览使用 `Image` 加载相同文件。资源只加载一次并缓存。个别文件加载失败时，对应物体保留 Canvas 绘制后备画面，不影响换道、碰撞或结算。

## 编辑与重新渲染

使用 Blender 打开 `.blend` 文件后可以调整模型与材质。自动重建使用 `tools/blender/build_assets.py`，实际渲染配置和素材尺寸以脚本及输出清单为准。脚本重新生成的文件会覆盖同名素材，下一次小游戏重新编译或浏览器刷新后生效。

当前机器 Blender 路径：`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`。测试环境版本为 Blender 5.2.1 LTS。

在工作区根目录运行完整重建：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 6 --python tools/blender/build_assets.py
```

仅试渲染主车可在末尾追加 `-- --only car-player`。完整重建使用 Cycles CPU 渲染、去噪和透明背景，生成单个素材、模型展示图以及资源清单。素材的取景尺寸和接地锚点保存在 `公路之王/assets/blender/manifest.json`，便于保持游戏中的比例与落地位置一致。自动重建以 Python 脚本为来源，会重新生成 `.blend`；手工编辑后的模型请另存版本。

## 强度 4–5 夜间与 6–9 清晨雾景

`art/blender/night-road.blend` 为新增的独立可编辑路灯场景，包含灯杆、悬臂、灯壳、暖光 LED 面板、底座与反光标。`night-road.png` 是 Blender Cycles 模型预览。运行 `tools/blender/build_night_scene.py` 可重建该模型并将 1692 个顶点追加到实时网格；重复运行会替换原路灯数据。完整运行时导出脚本也会重建夜间模型。

运行时前三档保持黄昏；正常升级至第四档时，在 2.5 秒内平滑过渡至夜间。起点跟随各档持续时间和 `startTier` 开局强度计算。`startTier: 4/5` 直接黑夜开局；暂停时过渡停住，结算保留夜景，首页显示黄昏，重开按所选开局强度恢复场景。

夜间天空包含星空、月亮和冷色环境光。道路两侧每 28 米重复布置路灯；移动灯光范围与灯杆位置同步，车前照明跟随玩家横向换道，保留车灯发光与障碍辨识度。照明使用轻量着色器近似，不是真实时阴影投射或全局光照。

`tests/night-scene.test.js` 验证自动切换和自定义时长。`tools/verify_night_preview.cjs` 检查两种手机尺寸的 WebGL 编译、网格加载、照明、重开以及截图，结果位于 `research/blender-preview/night-scene.json`。尚未进行真机性能验证。

## 验证边界

Node 测试覆盖无尽规则与图片加载成功、缓存、失败和重试；浏览器检查真实图片加载、多个屏幕尺寸、游戏操作、较长驾驶和缺图后备绘制。报告中的浏览器截图不等同于抖音模拟器或手机真机验证。

强度 6–9 使用同一套 Blender 几何，切换晨光材质与实时距离雾，无需再下载一套模型。清晨天空带淡金色太阳、冷灰蓝天色，低空雾气随距离和高度变化并缓慢漂移。近处 14 米内不叠加晨雾，随后逐渐遮淡远景；这是移动端轻量距离雾，不是体积散射。场景和雾密度均可逐档配置。`tests/dawn-scene.test.js` 覆盖九档递进、夜转晨、暂停和各新增强度的障碍生成；浏览器报告同时包含强度 6–9 的检查与截图。

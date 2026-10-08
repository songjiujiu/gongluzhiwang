# Blender 美术资源与游戏接入

## 交付结构

- `art/blender/roadking-assets.blend`：可编辑的 Blender 模型、材质、灯光和相机。
- `art/blender/showcase.png`：Blender 模型展示渲染。
- `tools/blender/build_assets.py`：可复现的建模与渲染脚本。
- `公路之王/assets/blender/`：游戏直接使用的透明 PNG 资源。
- `research/blender-preview/`：实际浏览器游戏截图与验证记录。

美术采用金属车漆、深色玻璃、轮胎轮毂与灯组细节，搭配暖色光照和海岸公路。玩家车保持青色，威胁车保持橙色，以便高速下识别；施工路障保留醒目的条纹。

## 渲染方式

模型由 Blender 创建并预渲染成透明图片，游戏通过原生 Canvas 2D 的 `drawImage` 绘制，沿用现有透视缩放、深度排序与三车道逻辑。这是 **Blender 模型预渲染素材**，游戏运行时仍为抖音原生 Canvas，并未改成实时 3D 引擎。

模型文件与渲染脚本放在抖音项目目录外，手机运行只需要 PNG；不需要安装 Blender、访问外部素材服务器或加载 `.blend` 文件。道路、护栏、天际线、光效和交互界面由 Canvas 绘制，与 Blender 车辆及路边模型组合。

## 素材用途

| 文件 | 内容 | 用途 |
| --- | --- | --- |
| `car-player.png` | 青色跑车 | 玩家驾驶车辆 |
| `car-silver.png` | 银灰 SUV | 普通车流 |
| `car-blue.png` | 蓝色轿车 | 普通车流 |
| `car-orange.png` | 橙色跑车 | 提前预告变线的威胁车 |
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

## 验证边界

Node 测试覆盖无尽规则与图片加载成功、缓存、失败和重试；浏览器检查真实图片加载、多个屏幕尺寸、游戏操作、较长驾驶和缺图后备绘制。报告中的浏览器截图不等同于抖音模拟器或手机真机验证。

# 游戏音效来源

## 汽车碰撞拟音

作者：**qubodup (Iwan Gabovitch)**。来源：[Clank Car Crash Collision](https://freesound.org/people/qubodup/sounds/151624/)，授权：[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。来源页于 2026-10-10 核验。作者为 Trigger Rally 制作的拟音，并非真实事故现场录音。

- `collision-qubodup-151624.mp3`：来源页公开高质量预览，https://cdn.freesound.org/previews/151/151624_71257-hq.mp3 。
- `collision-source.wav`：上述文件以 FFmpeg 解码为单声道 22050 Hz 16 位 PCM，无其他处理。
- `python tools/generate_collision_audio.py`：裁掉开头静音、45 Hz 去低频偏移、4800 Hz 柔化高频、轻微增强 220 Hz 以下车体共振，峰值归一至 0.88，尾部淡出 20 ms，生成游戏 `hit.wav`。
- `python tools/generate_audio.py` 同样调用该处理脚本，避免重新生成时恢复旧合成碰撞声。

## Lotus V8 实录素材

作者：**wikusv**。授权：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。

来自 [V8 Lotus](https://freesound.org/people/wikusv/packs/14238/) 录音集，作者说明使用发动机下方的枪式麦克风及外部电容麦克风录制。

- `lotus-rev.mp3`：[Idle and Rev - Engine.wav](https://freesound.org/people/wikusv/sounds/232272/) 的公开高质量音频版本。
- `lotus-idle.mp3`：[Idle.wav](https://freesound.org/people/wikusv/sounds/232274/) 的公开高质量音频版本。
- 同名 WAV：浏览器解码、双声道平均至单声道、22050 Hz PCM，供循环剪辑脚本使用。

重建：`node tools/decode_engine_recordings.cjs`，再运行 `python tools/generate_engine_audio.py`。行驶引擎取转速稳定的 12.8–19.2 秒，以 320 毫秒交叉淡化、柔和稳幅和少量滤波滚动噪声形成 6.08 秒持续行驶循环；怠速取 2.0–4.4 秒并交叉淡化 160 毫秒。

署名随发行包保存在 `公路之王/audio/CREDITS.md`。引擎主体为真实录音，未添加合成振荡器或音乐。`src/engine-audio.js` 使用持久内存音源与平滑参数控制，避免变速时重播和播放器循环的空隙。

# Lotus V8 实录素材

作者：**wikusv**。授权：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。

来自 [V8 Lotus](https://freesound.org/people/wikusv/packs/14238/) 录音集，作者说明使用发动机下方的枪式麦克风及外部电容麦克风录制。

- `lotus-rev.mp3`：[Idle and Rev - Engine.wav](https://freesound.org/people/wikusv/sounds/232272/) 的公开高质量音频版本。
- `lotus-idle.mp3`：[Idle.wav](https://freesound.org/people/wikusv/sounds/232274/) 的公开高质量音频版本。
- 同名 WAV：浏览器解码、双声道平均至单声道、22050 Hz PCM，供循环剪辑脚本使用。

重建：`node tools/decode_engine_recordings.cjs`，再运行 `python tools/generate_engine_audio.py`。轰鸣取 7.0–9.4 秒，怠速取 2.0–4.4 秒，各使用 160 毫秒交叉淡化并调整峰值。

署名随发行包保存在 `公路之王/audio/CREDITS.md`。当前素材为真实录音，未添加合成振荡器或音乐。

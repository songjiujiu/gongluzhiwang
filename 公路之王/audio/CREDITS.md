# 跑车引擎录音署名

Recordings by **wikusv**, from the **V8 Lotus** pack on Freesound.

- [Idle and Rev - Engine.wav](https://freesound.org/people/wikusv/sounds/232272/)
- [Idle.wav](https://freesound.org/people/wikusv/sounds/232274/)
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)

用于 `engine.wav` 和 `engine-idle.wav`。修改：使用公开高质量 MP3 版本，转为单声道 22050 Hz PCM，截取稳定转速实录片段，去除直流偏移，柔和控制音量波动，叠加少量原创滤波滚动噪声，调整峰值并交叉淡化循环边界。游戏内通过内存音源平滑调整转速和两段录音的音量。

完整来源与处理脚本见项目 `art/audio/` 和 `tools/generate_engine_audio.py`。

## 本次用户提供的视频音乐

`music-build.mp3` 和 `music-climax.mp3` 从用户指定的 `9e28ff743806ed6c9766e31020b8b022.mp4` 音轨截取。视频画面标注《黑街 DJ》，未核实音乐作者。按本次请求接入：铺垫为 0–32 秒，高能量候选段为 40–72 秒（8 秒窗口 RMS 显著高于前段），转换为 96 kbps 单声道 MP3，片头片尾淡化。素材来源为用户文件，不归入上述引擎录音的 CC BY 授权。

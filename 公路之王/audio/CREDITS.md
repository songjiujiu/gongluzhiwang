# 音效素材署名

## 碰撞音效

`hit.wav` 使用 **qubodup (Iwan Gabovitch)** 的 [Clank Car Crash Collision](https://freesound.org/people/qubodup/sounds/151624/)，授权为 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。这是为赛车游戏制作的碰撞拟音。

修改：公开高质量 MP3 解码为单声道 22050 Hz PCM；去除开头静音、滤除低频偏移、柔化高频、增强车体低频共振、调整峰值及末尾淡出。原素材和可重复生成脚本见 `art/audio/` 与 `tools/generate_collision_audio.py`。

## 跑车引擎录音

Recordings by **wikusv**, from the **V8 Lotus** pack on Freesound.

- [Idle and Rev - Engine.wav](https://freesound.org/people/wikusv/sounds/232272/)
- [Idle.wav](https://freesound.org/people/wikusv/sounds/232274/)
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)

用于 `engine.wav` 和 `engine-idle.wav`。修改：使用公开高质量 MP3 版本，转为单声道 22050 Hz PCM，截取稳定转速实录片段，去除直流偏移，柔和控制音量波动，叠加少量原创滤波滚动噪声，调整峰值并交叉淡化循环边界。游戏内通过内存音源平滑调整转速和两段录音的音量。

完整来源与处理脚本见项目 `art/audio/` 和 `tools/generate_engine_audio.py`。

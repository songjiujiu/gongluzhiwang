'use strict';
// 修改这里后重新编译。时间单位秒，速度 km/h，概率范围 0–1。
// 前八档 durationSeconds 控制进入下一档的时间。
// 最后一档无限持续，durationSeconds 控制速度/密度趋近终值的快慢。
// 强度 1–3 黄昏，4–5 黑夜，6–9 清晨雾景；第 9 档无限持续。
// `label` | 界面显示的强度名称 |
// | `durationSeconds` | 本档持续秒数；最后一档无限持续，该值控制趋近最终速度和密度的时间尺度 |
// | `scene` | 场景：sunset 黄昏 / night 黑夜 / dawn 清晨 |
// | `fogDensity` | 清晨雾密度，0–0.04；越大远处越朦胧，近处保留可见范围 |
// | `speedStart` / `speedEnd` | 本档巡航起始与最终速度，km/h，范围大于 0，没有固定最大速度限制 |
// | `spawnStart` / `spawnEnd` | 本档起始与最终障碍生成间隔，秒，数值越小越密集；前方拥挤时仍会推迟生成 |
// | `reactionSeconds` | 生成障碍时预留的反应秒数，大于 0 |
// | `mergeWarningMin` / `mergeWarningMax` | 打灯等待随机范围（秒），最小值大于 0，最大值不小于最小值 |
// | `mergeChance` | 车辆变道概率，0–1；0 关闭变道，1 为所有符合安全条件的波次开启变道 |
// | `doubleChance` | 一组生成双障碍的概率，0–1 |
// | `barrierChance` | 一组生成固定路障的概率，0–1 |
// | `maxActiveObstacles` | 同时存在的前方有效障碍上限，整数，至少 2
module.exports={
  // 开局强度：1–9。4/5 直接黑夜，6–9 直接清晨雾景。
  "startTier":1,
  "stages": [
    {
      "label": "轻松起步",
      "scene": "sunset",
      "durationSeconds": 10,
      "speedStart": 76,
      "speedEnd": 90,
      "spawnStart": 4.6,
      "spawnEnd": 4.1,
      "reactionSeconds": 5,
      "mergeChance": 0,
      "doubleChance": 0,
      "barrierChance": 0,
      "maxActiveObstacles": 4
    },
    {
      "label": "地狱开局",
      "scene": "sunset",
      "durationSeconds": 30,
      "speedStart": 240,
      "speedEnd": 320,
      "spawnStart": 1.1,
      "spawnEnd": 0.85,
      "reactionSeconds": 1.05,
      "mergeWarningMin": 0.35,
      "mergeWarningMax": 0.55,
      "mergeChance": 0.9,
      "doubleChance": 0.7,
      "barrierChance": 0.15,
      "maxActiveObstacles": 10
    },
    {
      "label": "极限闪避",
      "scene": "sunset",
      "durationSeconds": 30,
      "speedStart": 380,
      "speedEnd": 480,
      "spawnStart": 0.8,
      "spawnEnd": 0.65,
      "reactionSeconds": 0.85,
      "mergeWarningMin": 0.25,
      "mergeWarningMax": 0.4,
      "mergeChance": 0.95,
      "doubleChance": 0.82,
      "barrierChance": 0.25,
      "maxActiveObstacles": 14
    },
    {
      "label": "黑夜狂飙",
      "scene": "night",
      "durationSeconds": 60,
      "speedStart": 560,
      "speedEnd": 760,
      "spawnStart": 0.6,
      "spawnEnd": 0.45,
      "reactionSeconds": 0.7,
      "mergeWarningMin": 0.18,
      "mergeWarningMax": 0.3,
      "mergeChance": 1,
      "doubleChance": 0.92,
      "barrierChance": 0.32,
      "maxActiveObstacles": 18
    },
    {
      "label": "深夜极限",
      "scene": "night",
      "durationSeconds": 60,
      "speedStart": 800,
      "speedEnd": 900,
      "spawnStart": 0.44,
      "spawnEnd": 0.4,
      "reactionSeconds": 0.68,
      "mergeWarningMin": 0.17,
      "mergeWarningMax": 0.28,
      "mergeChance": 1,
      "doubleChance": 0.94,
      "barrierChance": 0.35,
      "maxActiveObstacles": 20
    },
    {
      "label": "晨雾初现",
      "scene": "dawn",
      "fogDensity": 0.014,
      "durationSeconds": 60,
      "speedStart": 950,
      "speedEnd": 1050,
      "spawnStart": 0.39,
      "spawnEnd": 0.35,
      "reactionSeconds": 0.66,
      "mergeWarningMin": 0.16,
      "mergeWarningMax": 0.26,
      "mergeChance": 1,
      "doubleChance": 0.95,
      "barrierChance": 0.38,
      "maxActiveObstacles": 22
    },
    {
      "label": "雾海疾驰",
      "scene": "dawn",
      "fogDensity": 0.018,
      "durationSeconds": 60,
      "speedStart": 1100,
      "speedEnd": 1200,
      "spawnStart": 0.34,
      "spawnEnd": 0.3,
      "reactionSeconds": 0.64,
      "mergeWarningMin": 0.15,
      "mergeWarningMax": 0.25,
      "mergeChance": 1,
      "doubleChance": 0.96,
      "barrierChance": 0.41,
      "maxActiveObstacles": 24
    },
    {
      "label": "浓雾穿行",
      "scene": "dawn",
      "fogDensity": 0.021,
      "durationSeconds": 60,
      "speedStart": 1250,
      "speedEnd": 1350,
      "spawnStart": 0.29,
      "spawnEnd": 0.26,
      "reactionSeconds": 0.62,
      "mergeWarningMin": 0.14,
      "mergeWarningMax": 0.24,
      "mergeChance": 1,
      "doubleChance": 0.97,
      "barrierChance": 0.44,
      "maxActiveObstacles": 26
    },
    {
      "label": "迷雾极限",
      "scene": "dawn",
      "fogDensity": 0.024,
      "durationSeconds": 60,
      "speedStart": 1400,
      "speedEnd": 1600,
      "spawnStart": 0.25,
      "spawnEnd": 0.2,
      "reactionSeconds": 0.6,
      "mergeWarningMin": 0.13,
      "mergeWarningMax": 0.22,
      "mergeChance": 1,
      "doubleChance": 0.98,
      "barrierChance": 0.47,
      "maxActiveObstacles": 28
    }
  ]
};

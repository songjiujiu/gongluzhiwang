'use strict';
// 修改这里后重新编译。时间单位秒，速度 km/h，概率范围 0–1。
// 前三档 durationSeconds 控制进入下一档的时间。
// 最后一档无限持续，durationSeconds 控制速度/密度趋近终值的快慢。
// 默认节奏：前 10 秒教学，强度 2 陡增，强度 3/4 持续加压。
// `label` | 界面显示的强度名称 |
// | `durationSeconds` | 本档持续秒数。前三档结束后进入下一档；第四档无限持续，该值控制趋近最终速度和密度的时间尺度 |
// | `speedStart` / `speedEnd` | 本档巡航起始与最终速度，km/h，范围大于 0，没有固定最大速度限制 |
// | `spawnStart` / `spawnEnd` | 本档起始与最终障碍生成间隔，秒，数值越小越密集；前方拥挤时仍会推迟生成 |
// | `reactionSeconds` | 生成障碍时预留的反应秒数，大于 0 |
// | `mergeWarningMin` / `mergeWarningMax` | 打灯等待随机范围（秒），最小值大于 0，最大值不小于最小值 |
// | `mergeChance` | 车辆变道概率，0–1；0 关闭变道，1 为所有符合安全条件的波次开启变道 |
// | `doubleChance` | 一组生成双障碍的概率，0–1 |
// | `barrierChance` | 一组生成固定路障的概率，0–1 |
// | `maxActiveObstacles` | 同时存在的前方有效障碍上限，整数，至少 2
module.exports={
  "stages": [
    {
      "label": "轻松起步",
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
    }
  ]
};

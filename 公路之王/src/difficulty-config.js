'use strict';
// 修改这里后重新编译。时间单位秒，速度 km/h，概率范围 0–1。
// 前三档 durationSeconds 控制进入下一档的时间。
// 最后一档无限持续，durationSeconds 控制速度/密度趋近终值的快慢。
// `label` | 界面显示的强度名称 |
// | `durationSeconds` | 本档持续秒数。前三档结束后进入下一档；第四档无限持续，该值控制趋近最终速度和密度的时间尺度 |
// | `speedStart` / `speedEnd` | 本档巡航起始与最终速度，km/h，范围大于 0，没有固定最大速度限制 |
// | `spawnStart` / `spawnEnd` | 本档起始与最终障碍生成间隔，秒，数值越小越密集；前方拥挤时仍会推迟生成 |
// | `reactionSeconds` | 生成障碍时预留的反应秒数，大于 0 |
// | `mergeChance` | 车辆变道概率，0–1；0 关闭变道，1 为所有符合安全条件的波次开启变道 |
// | `doubleChance` | 一组生成双障碍的概率，0–1 |
// | `barrierChance` | 一组生成固定路障的概率，0–1 |
// | `maxActiveObstacles` | 同时存在的前方有效障碍上限，整数，至少 2
module.exports={
  "stages": [
    {
      "label": "轻松起步",
      "durationSeconds": 10,
      "speedStart": 1000,
      "speedEnd": 1000,
      "spawnStart": 4.6,
      "spawnEnd": 4.1,
      "reactionSeconds": 1,
      "mergeChance": 0,
      "doubleChance": 0,
      "barrierChance": 0,
      "maxActiveObstacles": 8
    },
    {
      "label": "变道提速",
      "durationSeconds": 30,
      "speedStart": 1500,
      "speedEnd": 1500,
      "spawnStart": 3.6,
      "spawnEnd": 3,
      "reactionSeconds": 4,
      "mergeChance": 0.65,
      "doubleChance": 0.2,
      "barrierChance": 0,
      "maxActiveObstacles": 8
    },
    {
      "label": "密集高速",
      "durationSeconds": 30,
      "speedStart": 20000,
      "speedEnd": 20000,
      "spawnStart": 2.5,
      "spawnEnd": 1.9,
      "reactionSeconds": 3.2,
      "mergeChance": 0.75,
      "doubleChance": 0.65,
      "barrierChance": 0.3,
      "maxActiveObstacles": 14
    },
    {
      "label": "极速挑战",
      "durationSeconds": 60,
      "speedStart": 40000,
      "speedEnd": 40000,
      "spawnStart": 1.45,
      "spawnEnd": 1.1,
      "reactionSeconds": 2.6,
      "mergeChance": 0.85,
      "doubleChance": 0.85,
      "barrierChance": 0.45,
      "maxActiveObstacles": 14
    }
  ]
};

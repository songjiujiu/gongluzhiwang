'use strict';
// 修改这里后重新编译。时间单位秒，速度 km/h，概率范围 0–1。
// 前三档 durationSeconds 控制进入下一档的时间。
// 最后一档无限持续，durationSeconds 控制速度/密度趋近终值的快慢。
module.exports={
  "stages": [
    {
      "label": "轻松起步",
      "durationSeconds": 30,
      "speedStart": 76,
      "speedEnd": 88,
      "spawnStart": 4.6,
      "spawnEnd": 4.1,
      "reactionSeconds": 5,
      "mergeChance": 0,
      "doubleChance": 0,
      "barrierChance": 0,
      "maxActiveObstacles": 8
    },
    {
      "label": "变道提速",
      "durationSeconds": 30,
      "speedStart": 112,
      "speedEnd": 145,
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
      "speedStart": 162,
      "speedEnd": 198,
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
      "speedStart": 218,
      "speedEnd": 228,
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

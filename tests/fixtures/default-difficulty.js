// Pin the original tuning for regression tests, independent of local user edits.
const config=require('../../公路之王/src/difficulty-config');
config.startTier=1;
for(const stage of config.stages){stage.mergeWarningMin=1.1;stage.mergeWarningMax=1.1;}
Object.assign(config.stages[0],{durationSeconds:30,speedStart:76,speedEnd:88,reactionSeconds:5,spawnStart:4.6,spawnEnd:4.1,mergeChance:0,doubleChance:0,barrierChance:0,maxActiveObstacles:8});
Object.assign(config.stages[1],{durationSeconds:30,speedStart:112,speedEnd:145,reactionSeconds:4,spawnStart:3.6,spawnEnd:3,mergeChance:.65,doubleChance:.2,barrierChance:0,maxActiveObstacles:8});
Object.assign(config.stages[2],{durationSeconds:30,speedStart:162,speedEnd:198,reactionSeconds:3.2,spawnStart:2.5,spawnEnd:1.9,mergeChance:.75,doubleChance:.65,barrierChance:.3,maxActiveObstacles:14});
Object.assign(config.stages[3],{durationSeconds:60,speedStart:218,speedEnd:228,reactionSeconds:2.6,spawnStart:1.45,spawnEnd:1.1,mergeChance:.85,doubleChance:.85,barrierChance:.45,maxActiveObstacles:14});

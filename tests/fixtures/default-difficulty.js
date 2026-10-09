// Pin the original tuning for regression tests, independent of local user edits.
const config=require('../../公路之王/src/difficulty-config');
Object.assign(config.stages[0],{durationSeconds:30,speedStart:76,speedEnd:88,reactionSeconds:5});
Object.assign(config.stages[1],{durationSeconds:30,speedStart:112,speedEnd:145});
Object.assign(config.stages[2],{durationSeconds:30,speedStart:162,speedEnd:198});
Object.assign(config.stages[3],{durationSeconds:60,speedStart:218,speedEnd:228});

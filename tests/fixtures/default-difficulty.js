// Pin the original tuning for regression tests, independent of local user edits.
const config=require('../../公路之王/src/difficulty-config');
Object.assign(config.stages[0],{durationSeconds:30,speedStart:76,speedEnd:88});

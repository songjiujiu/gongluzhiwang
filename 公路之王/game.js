const RoadKingApp = require('./src/game-app');
const createPlatform = require('./src/platform');
new RoadKingApp(createPlatform(tt));

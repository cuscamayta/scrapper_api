const container = require('./src/startup/container');
const server = container.resolve("app");
const { MONGO_URI } = container.resolve("config");
const mongoose = require('mongoose');

server.start();

// mongoose.connect(MONGO_URI, { useCreateIndex: true, useFindAndModify: false, useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
// }).catch(console.log);
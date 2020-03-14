const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, 'chat.json'));
console.log(__dirname);
const db = low(adapter);

module.exports = db;
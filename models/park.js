//mongoose module
const mongoose = require('mongoose');

//mongoose parks data schema
const parkSchema = new mongoose.Schema({
    parkCode: String
});

module.exports = mongoose.model('Park', parkSchema);
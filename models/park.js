//mongoose module
const mongoose = require('mongoose');

//mongoose parks data schema
//a schema of the data we will use from the database
const parkSchema = new mongoose.Schema(
    {
        fullName: String,
    },
    {
        collection: 'parksAllData'
    });

module.exports = mongoose.model('Park', parkSchema);
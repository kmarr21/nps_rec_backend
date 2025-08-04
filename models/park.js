//mongoose module
const mongoose = require('mongoose');

//mongoose parks data schema
//a schema of the data we will use from the database
const parkSchema = new mongoose.Schema(
    {
        fullName: String,
        activities: Array,
        parkCode: String,
        visitation: Array,
        description: String,
        images: Array,
        weather: Object

    },
    {
        collection: 'parksAllData'
    });

module.exports = mongoose.model('Park', parkSchema);
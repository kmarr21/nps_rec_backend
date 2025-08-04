const Park = require('../models/park');
const mongoose = require('mongoose');

//Get park data
exports.getFiveParks = async (req, res) => {
    console.log('getFiveParks controller hit');
    res.json([
        { parkCode: 'YNP', fullName: 'Yellowstone National Park' },
        { parkCode: 'GRCA', fullName: 'Grand Canyon National Park' }
    ]);
};

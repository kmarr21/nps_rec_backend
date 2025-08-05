const Park = require('../models/park');
const mongoose = require('mongoose');

//Get park data
exports.getFiveParks = async (req, res) => {
    try {
        console.log('getFiveParks controller hit');
        mongoose.set('debug', true);
        const parks = await Park.find().select('activities description fullName');
        res.json(parks);
    } catch (error) {
        console.error("Error fetching parks: ", error);
        res.status(500).json({ error: 'failed to fetch five parks' });
    }
};

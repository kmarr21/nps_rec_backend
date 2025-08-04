const Park = require('../models/park');
const mongoose = require('mongoose');

//Get park data
exports.getFiveParks = async (req, res) => {
    console.log('getFiveParks controller hit');
    exports.getFiveParks = async (req, res) => {
        try {
            console.log('getFiveParks controller hit');
            const parks = await Park.find().limit(5);
            console.log('Parks found:', parks);
            res.json(parks);
        } catch (error) {
            console.error("Error fetching parks: ", error);
            res.status(500).json({ error: 'failed to fetch five parks' });
        }
    };
};

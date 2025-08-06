const Park = require('../models/park');
const mongoose = require('mongoose');

//Get park data
exports.getFiveParks = async (req, res) => {
    try {
        console.log('getFiveParks controller hit');
        mongoose.set('debug', true);
        const parks = await Park.find().limit(10).select('activitites description fullName images latitude longitude parkCode topics visitation weather');
        res.json(parks);
    } catch (error) {
        console.error("Error fetching parks: ", error);
        res.status(500).json({error: 'failed to fetch five parks'});
    }
};

//KM ADDED: NEW function to receive survey data & return parks
exports.getRecommendedParks = async (req, res) => {
    try {
        console.log('Survey data received:', req.body);
        // now we just do the exact same thing as getFiveParks() above: just return the same parks, NO logic yet
        mongoose.set('debug', true);
        const parks = await Park.find().limit(10).select('activitites description fullName images latitude longitude parkCode topics visitation weather');
        res.json(parks);
    } catch (error) {
        console.error("Error fetching parks: ", error);
        res.status(500).json({error: 'failed to fetch parks'});
    }
};
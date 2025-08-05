const Park = require('../models/park');
const mongoose = require('mongoose');

//Get park data
exports.getFiveParks = async (req, res) => {
    try {
        console.log('getFiveParks controller hit');
        mongoose.set('debug', true);
        const parks = await Park.find({
            "activities.name": { $in: ["Cross-Country Skiing","Flying"] }})
            .select('activities description fullName images latitude longitude parkCode topics visitation weather');
        res.json(parks);
    } catch (error) {
        console.error("Error fetching parks: ", error);
        res.status(500).json({ error: 'failed to fetch five parks' });
    }
};

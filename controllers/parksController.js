const Park = require('../models/park');

//Get park data
exports.getFiveParks = async (req, res) => {
    try {
        console.log('getFiveParks controller hit');
        mongoose.set('debug', true);
        const parks = await Park.find().limit(5);
        console.log('Parks found:', parks);
        res.json(parks);
    } catch (error) {
        console.error("Error fetching parks: ", error);
        res.status(500).json({ error: 'failed to fetch five parks' });
    }
};

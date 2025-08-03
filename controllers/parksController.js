const Park = require('/models/park');

//Get park data
exports.getAllParks = async (req, res) => {
    try {
        const parks = await Park.find({});
        res.json(parks);
    } catch (error) {
        console.error("Error fetching parks: ", error);
        res.status(500).json({ error: 'failed to fetch parks' });
    }
};


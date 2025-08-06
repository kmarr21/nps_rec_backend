const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const connectDB = require('./config/db');

app.use(cors());
app.use(express.json());

//Test connection
app.get('/', (req, res) => {
    res.send({ message: 'Welcome to the NPS API root' });
});

// API key endpoint for frontend
app.get('/api/config/maps-key', (req, res) => {
    res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
});

//Google maps api connection
const googleMapsRoutes = require('./routes/googlemaps');
app.use('/api/restaurants', googleMapsRoutes);

//Test sending data to backend
app.post('/api/submit-data', (req, res) => {
    const receivedData = req.body;
    console.log('Received data:', receivedData);
    res.status(200).json({ message: 'Data received successfully!' });
});

//Park route
const parkRoutes = require('./routes/parksRoute');
app.use('/api/parks', parkRoutes);

//Parks database connection
connectDB();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
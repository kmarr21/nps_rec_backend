const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const googleMapsRoutes = require('./routes/googlemaps');
app.use('/api/restaurants', googleMapsRoutes);

app.get('/', (req, res) => {
    res.send({ message: 'Welcome to the NPS API root' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

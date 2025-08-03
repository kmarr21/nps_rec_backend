const express = require('express');
const router = express.Router();
const googleMapsController = require('../controllers/googleMapsController');

router.get('/', (req, res) => { res.send({ message: 'Welcome to the NPS API root' }); });

router.post('/search-restaurants', googleMapsController.searchRestaurants);

router.post('/autocomplete', googleMapsController.autocomplete);

router.post('/geocode', googleMapsController.geocode);

router.get('/health', googleMapsController.healthCheck);

module.exports = router;
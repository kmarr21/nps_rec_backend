const express = require('express');
const router = express.Router();
const googleMapsController = require('../controllers/googleMapsController');

router.get('/', (req, res) => {res.send({message: 'Welcome to the restuarant root' }); });

//router.post('/search-restaurants', googleMapsController.searchRestaurants);
router.post('/autocomplete', googleMapsController.autocomplete);
router.post('/geocode', googleMapsController.geocode);
router.get('/health', googleMapsController.healthCheck);

// NEW ROUTES FOR RESTAURANTS:
router.post('/search-restaurants-near-park', googleMapsController.searchRestaurantsNearPark);
router.post('/map-embed-url', googleMapsController.getMapEmbedUrl);

module.exports = router;
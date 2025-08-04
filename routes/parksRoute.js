const express = require('express');
const router = express.Router();
const parksController = require('../controllers/parksController');
const parkModel = require('../models/park');

router.get('/', parksController.getFiveParks);

module.exports = router;
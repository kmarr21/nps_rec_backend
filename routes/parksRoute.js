const express = require('express');
const router = express.Router();
const parksController = require('/controllers/parksController');

router.get('/', parksController.getAllParks);

module.exports = router;
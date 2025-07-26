const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// google maps client
const {Client} = require('@googlemaps/google-maps-services-js');
const client = new Client({});

app.get('/', (req, res) => {res.json({ message: 'Restaurant finder API is running...' });});

//main restaurant search endpoint (uses NEW places API)
app.post('/api/search-restaurants', async (req, res) => {
    try {
        const { location, cuisines, prices, time } = req.body;
        console.log('Search request:', { location, cuisines, prices, time });

        if (!location) {return res.status(400).json({ error: 'Location is required' });}

        // first: get coords from location using geocoding API
        const geocodeResponse = await client.geocode({params: {address: location, key: process.env.GOOGLE_MAPS_API_KEY}});

        if (geocodeResponse.data.results.length === 0) {
            return res.status(404).json({ error: 'Location not found' });}

        const {lat, lng} = geocodeResponse.data.results[0].geometry.location;
        console.log('Location coordinates:', { lat, lng });

        //build places API new request
        let textQuery = 'restaurants';
        
        // add cuisine prefs
        if (cuisines && cuisines.length > 0) {
            const cuisineQueries = cuisines.map(c => {
                switch(c) {
                    case 'italian': return 'italian restaurant';
                    case 'mexican': return 'mexican restaurant';
                    case 'asian': return 'asian restaurant';
                    case 'american': return 'american restaurant';
                    case 'seafood': return 'seafood restaurant';
                    case 'vegetarian': return 'vegetarian restaurant';
                    case 'fastfood': return 'fast food restaurant';
                    default: return c + ' restaurant';}});
            textQuery = cuisineQueries.join(' OR ');
        }

        // request for new places api
        const searchRequest = {
            textQuery: textQuery,
            locationBias: {
                circle: {center: {latitude: lat,longitude: lng}, radius: 5000.0}},
            pageSize: 20,
            rankPreference: 'RELEVANCE',
            languageCode: 'en'
        };

        // price filtering
        if (prices && prices.length > 0) {
            const priceLevels = prices.map(p => {
                switch(p) {
                    case 1: return 'PRICE_LEVEL_INEXPENSIVE';
                    case 2: return 'PRICE_LEVEL_MODERATE';
                    case 3: return 'PRICE_LEVEL_EXPENSIVE';
                    case 4: return 'PRICE_LEVEL_VERY_EXPENSIVE';
                    default: return 'PRICE_LEVEL_INEXPENSIVE';}});
            searchRequest.priceLevels = priceLevels;
        }

        // time-based filtering (not sure if this will work...)
        // . . . need probably a bit of work here
        if (time && time !== '') {searchRequest.openNow = true;}

        console.log('Places API request:', searchRequest);

        // MAKE REQUEST to new places api
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.types,places.id'
            },
            body: JSON.stringify(searchRequest)
        });

        if (!response.ok) {throw new Error(`Places API error: ${response.status} ${response.statusText}`);}
        const data = await response.json();
        console.log('Places API response:', data);

        if (!data.places || data.places.length === 0) {
            return res.json({
                restaurants: [],
                total_found: 0,
                search_location: {lat: lat, lng: lng, address: geocodeResponse.data.results[0].formatted_address}});
        }
        // process & format restaurants
        let restaurants = data.places;
        // sort by rating (highest first) & limit to 15
        restaurants = restaurants.filter(r => r.rating && r.rating > 0) //only include restaurants w/ ratings!
            .sort((a, b) => b.rating - a.rating).slice(0, 15);

        // format for frontend
        const formattedRestaurants = restaurants.map(restaurant => ({
            name: restaurant.displayName?.text || 'Unknown Restaurant',
            rating: restaurant.rating || 0,
            price_level: mapPriceLevel(restaurant.priceLevel) || 1,
            address: restaurant.formattedAddress || 'Address not available',
            place_id: restaurant.id,
            cuisine_types: restaurant.types?.filter(type => !['restaurant', 'food', 'establishment', 'point_of_interest'].includes(type)) || []
        }));

        res.json({
            restaurants: formattedRestaurants,
            total_found: formattedRestaurants.length,
            search_location: {lat: lat, lng: lng, address: geocodeResponse.data.results[0].formatted_address}
        });

    } catch (error) {
        console.error('Restaurant search error:', error);
        res.status(500).json({ 
            error: 'Failed to search restaurants',
            details: error.message });}
});

// map price levels to numbers
function mapPriceLevel(priceLevel) {
    if (!priceLevel) return 1;
    const priceMap = {
        'PRICE_LEVEL_FREE': 1,
        'PRICE_LEVEL_INEXPENSIVE': 1,
        'PRICE_LEVEL_MODERATE': 2,
        'PRICE_LEVEL_EXPENSIVE': 3,
        'PRICE_LEVEL_VERY_EXPENSIVE': 4};
    return priceMap[priceLevel] || 1;
}

// autocomplete endpoint for searching/matchign locations
app.post('/api/autocomplete', async (req, res) => {
    try {
        const { input } = req.body;
        if (!input || input.length < 2) {return res.json({ predictions: [] });}

        // use autocomplete
        const autocompleteRequest = {
            input: input,
            locationRestriction: {
                rectangle: {
                    low: { latitude: -90, longitude: -180 },
                    high: { latitude: 90, longitude: 180 }}},
            languageCode: 'en'
        };

        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text'
            },
            body: JSON.stringify(autocompleteRequest)
        });

        if (!response.ok) {throw new Error(`Autocomplete API error: ${response.status} ${response.statusText}`);}
        const data = await response.json();
        // format suggestions for frontend
        const predictions = data.suggestions?.map(suggestion => ({
            place_id: suggestion.placePrediction?.placeId,
            description: suggestion.placePrediction?.text?.text,
            structured_formatting: {
                main_text: suggestion.placePrediction?.text?.text?.split(',')[0] || '',
                secondary_text: suggestion.placePrediction?.text?.text?.split(',').slice(1).join(',').trim() || ''}
        })) || [];

        res.json({ predictions });

    } catch (error) {
        console.error('Autocomplete error:', error);
        res.status(500).json({error: 'Failed to get autocomplete suggestions', details: error.message });
    }
});

// geocoding endpoint
app.post('/api/geocode', async (req, res) => {
    try {
        const {location} = req.body;
        if (!location) {return res.status(400).json({ error: 'Location is required' });}

        const response = await client.geocode({params: {address: location, key: process.env.GOOGLE_MAPS_API_KEY}});

        if (response.data.results.length === 0) {
            return res.status(404).json({ error: 'Location not found' });}

        const result = response.data.results[0];
        const {lat, lng} = result.geometry.location;

        res.json({location: {lat: lat, lng: lng, formatted_address: result.formatted_address}});
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({ error: 'Failed to geocode location' });
    }
});

// endpoint check
app.get('/health', (req, res) => {
    res.json({status: 'healthy', timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'});});
app.listen(PORT, () => {console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);});
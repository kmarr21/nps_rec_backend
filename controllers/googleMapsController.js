const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
require('dotenv').config();

//main restaurant search endpoint (uses NEW places API)
exports.searchRestaurants = async (req, res) => {
    try {
        const { location, cuisines, prices, time } = req.body;
        console.log('Search request:', {location, cuisines, prices, time});

        if (!location) {return res.status(400).json({error: 'Location is required'});}

        // first: get coords from location using geocoding API
        const geocodeResponse = await client.geocode({params: {address: location, key: process.env.GOOGLE_MAPS_API_KEY}});

        if (geocodeResponse.data.results.length === 0) {return res.status(404).json({error: 'Location not found'});}

        const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
        console.log('Location coordinates:', {lat, lng});

        //build places API new request
        let textQuery = 'restaurants';

        // add cuisine prefs
        if (cuisines && cuisines.length > 0) {
            const cuisineQueries = cuisines.map(c => {
                switch (c) {
                    case 'italian': return 'italian restaurant';
                    case 'mexican': return 'mexican restaurant';
                    case 'asian': return 'asian restaurant';
                    case 'american': return 'american restaurant';
                    case 'seafood': return 'seafood restaurant';
                    case 'vegetarian': return 'vegetarian restaurant';
                    case 'fastfood': return 'fast food restaurant';
                    default: return c + ' restaurant';
                }
            });
            textQuery = cuisineQueries.join(' OR ');
        }

        // request for new places api
        const searchRequest = {
            textQuery: textQuery,
            locationBias: {circle: {center: { latitude: lat, longitude: lng }, radius: 5000.0}},
            pageSize: 20,
            rankPreference: 'RELEVANCE',
            languageCode: 'en'
        };

        // price filtering
        if (prices && prices.length > 0) {
            const priceLevels = prices.map(p => {
                switch (p) {
                    case 1: return 'PRICE_LEVEL_INEXPENSIVE';
                    case 2: return 'PRICE_LEVEL_MODERATE';
                    case 3: return 'PRICE_LEVEL_EXPENSIVE';
                    case 4: return 'PRICE_LEVEL_VERY_EXPENSIVE';
                    default: return 'PRICE_LEVEL_INEXPENSIVE';
                }
            });
            searchRequest.priceLevels = priceLevels;
        }

        console.log('Places API request:', searchRequest);

        // MAKE REQUEST to new places api
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.types,places.id'},
            body: JSON.stringify(searchRequest)
        });

        if (!response.ok) { throw new Error(`Places API error: ${response.status} ${response.statusText}`); }
        const data = await response.json();
        console.log('Places API response:', data);

        if (!data.places || data.places.length === 0) {
            return res.json({
                restaurants: [],
                total_found: 0,
                search_location: {lat: lat, lng: lng, address: geocodeResponse.data.results[0].formatted_address}
            });
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
            cuisine_types: restaurant.types?.filter(type => !['restaurant', 'food', 'establishment', 'point_of_interest'].includes(type)) || []}));

        res.json({
            restaurants: formattedRestaurants,
            total_found: formattedRestaurants.length,
            search_location: {lat: lat, lng: lng, address: geocodeResponse.data.results[0].formatted_address}
        });

    } catch (error) {
        console.error('Restaurant search error:', error);
        res.status(500).json({
            error: 'Failed to search restaurants',
            details: error.message});}
};

// map price levels to numbers
function mapPriceLevel(priceLevel) {
    if (!priceLevel) return 1;
    const priceMap = {
        'PRICE_LEVEL_FREE': 1,
        'PRICE_LEVEL_INEXPENSIVE': 1,
        'PRICE_LEVEL_MODERATE': 2,
        'PRICE_LEVEL_EXPENSIVE': 3,
        'PRICE_LEVEL_VERY_EXPENSIVE': 4
    };
    return priceMap[priceLevel] || 1;
}

// autocomplete endpoint for searching/matchign locations
exports.autocomplete = async (req, res) => {
    try {
        const { input } = req.body;
        if (!input || input.length < 2) {return res.json({ predictions: [] });}

        // use autocomplete
        const autocompleteRequest = {
            input: input,
            locationRestriction: {rectangle: {low: {latitude: -90, longitude: -180}, high: {latitude: 90, longitude: 180}}},
            languageCode: 'en'
        };

        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text'},
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
                secondary_text: suggestion.placePrediction?.text?.text?.split(',').slice(1).join(',').trim() || ''}})) || [];
        res.json({ predictions });

    } catch (error) {
        console.error('Autocomplete error:', error);
        res.status(500).json({error: 'Failed to get autocomplete suggestions', details: error.message});}
};

// geocoding endpoint
exports.geocode = async (req, res) => {
    try {
        const {location} = req.body;
        if (!location) {return res.status(400).json({ error: 'Location is required' }); }
        const response = await client.geocode({params: {address: location, key: process.env.GOOGLE_MAPS_API_KEY}});
        if (response.data.results.length === 0) {return res.status(404).json({ error: 'Location not found' });}
        const result = response.data.results[0];
        const {lat, lng} = result.geometry.location;

        res.json({location: {lat: lat, lng: lng, formatted_address: result.formatted_address}});
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({error: 'Failed to geocode location'});
    }
};

// endpoint check
exports.healthCheck = (req, res) => {
    res.json({status: 'healthy', timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'});
};

// ATTEMPT 4: legacy API that actually works with location (seeing if this works a bit better...)
exports.searchRestaurantsNearPark = async (req, res) => {
    try {
        const {latitude, longitude, radius, cuisines, prices, rating} = req.body;
        console.log('Park restaurant search:', { latitude, longitude, radius, cuisines, prices, rating });
        if (!latitude || !longitude) {return res.status(400).json({ error: 'Latitude and longitude are required' });}

        // legacy text search API
        let query = 'restaurants';
        
        // add cuisine filtering to query
        if (cuisines && cuisines.length > 0) {
            const cuisineQueries = cuisines.map(c => {
                const cuisineMap = {
                    'italian': 'italian restaurant',
                    'mexican': 'mexican restaurant', 
                    'asian': 'asian restaurant',
                    'american': 'american restaurant',
                    'chinese': 'chinese restaurant',
                    'japanese': 'japanese restaurant',
                    'thai': 'thai restaurant',
                    'indian': 'indian restaurant',
                    'seafood': 'seafood restaurant',
                    'steakhouse': 'steakhouse',
                    'pizza': 'pizza restaurant',
                    'fastfood': 'fast food',
                    'vegetarian': 'vegetarian restaurant',
                    'vegan': 'vegan restaurant',
                    'french': 'french restaurant',
                    'greek': 'greek restaurant'};
                return cuisineMap[c] || (c + ' restaurant');
            });
            query = cuisineQueries.join(' OR ');
        }

        // build legacy API URL
        const textSearchUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
        const params = new URLSearchParams({
            query: query,
            location: `${parseFloat(latitude)},${parseFloat(longitude)}`,
            radius: Math.min(parseFloat(radius) || 50000, 50000),
            type: 'restaurant',
            key: process.env.GOOGLE_MAPS_API_KEY});

        console.log('Legacy API request:', `${textSearchUrl}?${params.toString()}`);

        // make request to legacy API
        const response = await fetch(`${textSearchUrl}?${params.toString()}`);
        
        if (!response.ok) {throw new Error(`Places API error: ${response.status} ${response.statusText}`);}
        
        const data = await response.json();
        console.log('Legacy API response status:', data.status);

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            return res.json({
                restaurants: [],
                total_found: 0,
                search_center: { lat: parseFloat(latitude), lng: parseFloat(longitude) },
                radius: parseFloat(radius) || 50000,
                map_bounds: {
                    northeast: {lat: parseFloat(latitude) + 0.1, lng: parseFloat(longitude) + 0.1},
                    southwest: {lat: parseFloat(latitude) - 0.1, lng: parseFloat(longitude) - 0.1}}});
        }

        // process restaurants
        let restaurants = data.results;
        // filter by rating if specified
        if (rating && rating > 0) {restaurants = restaurants.filter(r => r.rating && r.rating >= rating);}
        // filter by price level if specified  
        if (prices && prices.length > 0) {restaurants = restaurants.filter(r => r.price_level && prices.includes(r.price_level));}
        // sort by rating and limit results
        restaurants = restaurants.filter(r => r.rating && r.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 20);

        // format for frontend (mapping legacy API fields to frontend expectations?? Not sure this is best way to do this....)
        const formattedRestaurants = restaurants.map(restaurant => ({
            name: restaurant.name || 'Unknown Restaurant',
            rating: restaurant.rating || 0,
            price_level: restaurant.price_level || 1,
            address: restaurant.formatted_address || 'Address not available',
            place_id: restaurant.place_id,
            cuisine_types: restaurant.types?.filter(type => !['restaurant', 'food', 'establishment', 'point_of_interest'].includes(type)) || [],
            location: {
                lat: restaurant.geometry?.location?.lat || parseFloat(latitude),
                lng: restaurant.geometry?.location?.lng || parseFloat(longitude)},
            business_status: restaurant.business_status || 'OPERATIONAL',
            opening_hours: restaurant.opening_hours?.weekday_text || []
        }));

        // calc map bounds?...
        let bounds = {
            northeast: {lat: parseFloat(latitude), lng: parseFloat(longitude)},
            southwest: {lat: parseFloat(latitude), lng: parseFloat(longitude)}
        };

        if (formattedRestaurants.length > 0) {
            const lats = formattedRestaurants.map(r => r.location.lat);
            const lngs = formattedRestaurants.map(r => r.location.lng);
            
            bounds = {
                northeast: {
                    lat: Math.max(...lats, parseFloat(latitude)),
                    lng: Math.max(...lngs, parseFloat(longitude))},
                southwest: {
                    lat: Math.min(...lats, parseFloat(latitude)),
                    lng: Math.min(...lngs, parseFloat(longitude))}
            };
        }

        res.json({
            restaurants: formattedRestaurants,
            total_found: formattedRestaurants.length,
            search_center: {lat: parseFloat(latitude), lng: parseFloat(longitude)},
            radius: parseFloat(radius) || 50000,
            map_bounds: bounds
        });

    } catch (error) {
        console.error('Park restaurant search error:', error);
        res.status(500).json({
            error: 'Failed to search restaurants near park',
            details: error.message});}
};

// map price levels to numbers
function mapPriceLevel(priceLevel) {
    if (!priceLevel) return 1;
    const priceMap = {
        'PRICE_LEVEL_FREE': 1,
        'PRICE_LEVEL_INEXPENSIVE': 1,
        'PRICE_LEVEL_MODERATE': 2,
        'PRICE_LEVEL_EXPENSIVE': 3,
        'PRICE_LEVEL_VERY_EXPENSIVE': 4
    };
    return priceMap[priceLevel] || 1;
}

// autocomplete endpoint for searching/matchign locations
exports.autocomplete = async (req, res) => {
    try {
        const {input} = req.body;
        if (!input || input.length < 2) {return res.json({ predictions: []});}

        // use autocomplete
        const autocompleteRequest = {
            input: input,
            locationRestriction: {rectangle: {low: {latitude: -90, longitude: -180}, high: {latitude: 90, longitude: 180}}},
            languageCode: 'en'
        };

        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text'},
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
                secondary_text: suggestion.placePrediction?.text?.text?.split(',').slice(1).join(',').trim() || ''}})) || [];

        res.json({ predictions });

    } catch (error) {
        console.error('Autocomplete error:', error);
        res.status(500).json({error: 'Failed to get autocomplete suggestions', details: error.message});
    }
};

// geocoding endpoint
exports.geocode = async (req, res) => {
    try {
        const {location} = req.body;
        if (!location) {return res.status(400).json({error: 'Location is required'});}
        const response = await client.geocode({params: {address: location, key: process.env.GOOGLE_MAPS_API_KEY}});
        if (response.data.results.length === 0) {return res.status(404).json({error: 'Location not found'});}

        const result = response.data.results[0];
        const {lat, lng} = result.geometry.location;

        res.json({location: {lat: lat, lng: lng, formatted_address: result.formatted_address}});
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({ error: 'Failed to geocode location' });
    }
};

// endpoint check
exports.healthCheck = (req, res) => {
    res.json({status: 'healthy', timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'});
};

// function to get map embed url for frontend
exports.getMapEmbedUrl = async (req, res) => {
    try {
        const {latitude, longitude, zoom, restaurants} = req.body;
        if (!latitude || !longitude) {return res.status(400).json({error: 'Latitude and longitude are required'});}

        // build GM embed url
        const baseUrl = 'https://www.google.com/maps/embed/v1/view';
        const params = new URLSearchParams({
            key: process.env.GOOGLE_MAPS_API_KEY,
            center: `${latitude},${longitude}`,
            zoom: zoom || 12,
            maptype: 'roadmap'});

        const embedUrl = `${baseUrl}?${params.toString()}`;
        res.json({
            embed_url: embedUrl,
            center: { lat: parseFloat(latitude), lng: parseFloat(longitude) },
            zoom: zoom || 12});

    } catch (error) {
        console.error('Map embed URL error:', error);
        res.status(500).json({
            error: 'Failed to generate map embed URL',
            details: error.message});}
};
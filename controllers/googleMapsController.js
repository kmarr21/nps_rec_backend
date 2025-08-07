const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
require('dotenv').config();

// helper function to map price levels
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

// park-based restaurant search (for restaurant-selector.html) --> NEW PLACES API ONLY
exports.searchRestaurantsNearPark = async (req, res) => {
    try {
        const {latitude, longitude, radius} = req.body;
        console.log('=== PARK RESTAURANT SEARCH DEBUG ===');
        console.log('Park search request:', {latitude, longitude, radius});

        if (!latitude || !longitude) {return res.status(400).json({ error: 'Latitude and longitude are required'});}

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const searchRadius = parseFloat(radius) || 25000;

        console.log('Parsed coordinates:', { lat, lng, searchRadius });

        //building NEW Places API request
        const searchRequest = {
            includedTypes: ['restaurant'],
            maxResultCount: 50,
            locationRestriction: {
                circle: {
                    center: {latitude: lat, longitude: lng},
                    radius: searchRadius
                }
            }
        };

        console.log('NEW Places API request:', JSON.stringify(searchRequest, null, 2));

        //make request to NEW Places API
        const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.id,places.location,places.businessStatus,places.types'
            },
            body: JSON.stringify(searchRequest)
        });

        console.log('Places API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('Places API error response:', errorText);
            throw new Error(`Places API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('=== GOOGLE PLACES API RESPONSE DEBUG ===');
        console.log('Total places returned by Google:', data.places?.length || 0);
        console.log('Requested maxResultCount:', 50);
        console.log('=== END GOOGLE RESPONSE DEBUG ===');

        const restaurantsList = (data.places || []).filter(place => place.location?.latitude && place.location?.longitude);

        if (!data.places || data.places.length === 0) {
            console.log('No places found, returning empty result');
            return res.json({
                restaurants: [],
                total_found: 0,
                search_center: { lat, lng },
                radius: searchRadius
            });
        }

        // format for frontend
        const formattedRestaurants = restaurantsList.map((restaurant, index) => {
            const formatted = {
                name: restaurant.displayName?.text || 'Unknown Restaurant',
                rating: restaurant.rating || 0,
                price_level: mapPriceLevel(restaurant.priceLevel) || 1,
                address: restaurant.formattedAddress || 'Address not available',
                place_id: restaurant.id,
                cuisine_types: restaurant.types?.filter(type => !['restaurant', 'food', 'establishment', 'point_of_interest'].includes(type)) || [],
                location: { lat: restaurant.location.latitude, lng: restaurant.location.longitude },
                business_status: restaurant.businessStatus || 'OPERATIONAL',
                opening_hours: []
            };

            if (index < 3) {
                console.log(`Formatted restaurant ${index + 1}:`, {
                    name: formatted.name,
                    location: formatted.location,
                    address: formatted.address
                });
            }
            return formatted;
        });

        // calc map bounds
        let bounds = {northeast: {lat, lng}, southwest: {lat, lng}};

        if (formattedRestaurants.length > 0) {
            const lats = formattedRestaurants.map(r => r.location.lat);
            const lngs = formattedRestaurants.map(r => r.location.lng);

            bounds = {
                northeast: {lat: Math.max(...lats, lat), lng: Math.max(...lngs, lng)},
                southwest: {lat: Math.min(...lats, lat), lng: Math.min(...lngs, lng)}
            };

            console.log('Calculated map bounds:', bounds);
        }

        console.log('=== END PARK RESTAURANT SEARCH DEBUG ===');

        res.json({
            restaurants: formattedRestaurants,
            total_found: formattedRestaurants.length,
            search_center: { lat, lng },
            radius: searchRadius,
            map_bounds: bounds
        });

    } catch (error) {
        console.error('Park restaurant search error:', error);
        res.status(500).json({ error: 'Failed to search restaurants near park', details: error.message });
    }
};

// autocomplete endpoint
exports.autocomplete = async (req, res) => {
    try {
        const { input } = req.body;
        if (!input || input.length < 2) {
            return res.json({ predictions: [] });
        }

        const autocompleteRequest = {
            input: input,
            locationRestriction: { rectangle: { low: { latitude: -90, longitude: -180 }, high: { latitude: 90, longitude: 180 } } },
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

        if (!response.ok) { throw new Error(`Autocomplete API error: ${response.status} ${response.statusText}`); }

        const data = await response.json();
        const predictions = data.suggestions?.map(suggestion => ({
            place_id: suggestion.placePrediction?.placeId,
            description: suggestion.placePrediction?.text?.text,
            structured_formatting: {
                main_text: suggestion.placePrediction?.text?.text?.split(',')[0] || '',
                secondary_text: suggestion.placePrediction?.text?.text?.split(',').slice(1).join(',').trim() || ''
            }
        })) || [];

        res.json({ predictions });

    } catch (error) {
        console.error('Autocomplete error:', error);
        res.status(500).json({ error: 'Failed to get autocomplete suggestions', details: error.message });
    }
};

// geocoding endpoint
exports.geocode = async (req, res) => {
    try {
        const { location } = req.body;
        if (!location) { return res.status(400).json({ error: 'Location is required' }); }
        const response = await client.geocode({ params: { address: location, key: process.env.GOOGLE_MAPS_API_KEY } });
        if (response.data.results.length === 0) { return res.status(404).json({ error: 'Location not found' }); }
        const result = response.data.results[0];
        const { lat, lng } = result.geometry.location;
        res.json({ location: { lat: lat, lng: lng, formatted_address: result.formatted_address } });
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({ error: 'Failed to geocode location' });
    }
};

//healthcheck endpoint
exports.healthCheck = (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
};

// map embed URL endpoint
exports.getMapEmbedUrl = async (req, res) => {
    try {
        const { latitude, longitude, zoom } = req.body;
        if (!latitude || !longitude) { return res.status(400).json({ error: 'Latitude and longitude are required' }); }

        const baseUrl = 'https://www.google.com/maps/embed/v1/view';
        const params = new URLSearchParams({
            key: process.env.GOOGLE_MAPS_API_KEY,
            center: `${latitude},${longitude}`,
            zoom: zoom || 12,
            maptype: 'roadmap'
        });

        const embedUrl = `${baseUrl}?${params.toString()}`;
        res.json({
            embed_url: embedUrl,
            center: { lat: parseFloat(latitude), lng: parseFloat(longitude) },
            zoom: zoom || 12
        });

    } catch (error) {
        console.error('Map embed URL error:', error);
        res.status(500).json({ error: 'Failed to generate map embed URL', details: error.message });
    }
};
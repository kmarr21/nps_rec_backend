const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
require('dotenv').config();

// Helper function to map price levels
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

// Main restaurant search endpoint (for restaurant-example.html)
exports.searchRestaurants = async (req, res) => {
    try {
        const { location, cuisines, prices, time } = req.body;
        console.log('=== RESTAURANT SEARCH DEBUG ===');
        console.log('Search request:', { location, cuisines, prices, time });

        if (!location) { 
            return res.status(400).json({ error: 'Location is required' }); 
        }

        // Get coordinates from location using geocoding API
        console.log('Geocoding location:', location);
        const geocodeResponse = await client.geocode({ 
            params: { address: location, key: process.env.GOOGLE_MAPS_API_KEY } 
        });

        if (geocodeResponse.data.results.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }

        const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
        console.log('Geocoded coordinates:', { lat, lng });

        // Build search query
        let textQuery = 'restaurants';
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

        // Build NEW Places API request
        const searchRequest = {
            textQuery: textQuery,
            locationBias: {
                circle: { 
                    center: { latitude: lat, longitude: lng }, 
                    radius: 15000.0 
                }
            },
            pageSize: 20,
            rankPreference: 'RELEVANCE',
            languageCode: 'en'
        };

        // Add price filtering
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

        console.log('NEW Places API request:', JSON.stringify(searchRequest, null, 2));

        // Make request to NEW Places API
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.types,places.id'
            },
            body: JSON.stringify(searchRequest)
        });

        if (!response.ok) { 
            console.log('Places API error response:', response.status, response.statusText);
            throw new Error(`Places API error: ${response.status} ${response.statusText}`); 
        }

        const data = await response.json();
        console.log('Places API response places count:', data.places?.length || 0);

        if (!data.places || data.places.length === 0) {
            return res.json({
                restaurants: [],
                total_found: 0,
                search_location: { lat: lat, lng: lng, address: geocodeResponse.data.results[0].formatted_address }
            });
        }

        // Process restaurants
        let restaurants = data.places;
        restaurants = restaurants.filter(r => r.rating && r.rating > 0)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 15);

        // Format for frontend
        const formattedRestaurants = restaurants.map(restaurant => ({
            name: restaurant.displayName?.text || 'Unknown Restaurant',
            rating: restaurant.rating || 0,
            price_level: mapPriceLevel(restaurant.priceLevel) || 1,
            address: restaurant.formattedAddress || 'Address not available',
            place_id: restaurant.id,
            cuisine_types: restaurant.types?.filter(type => 
                !['restaurant', 'food', 'establishment', 'point_of_interest'].includes(type)
            ) || []
        }));

        console.log('Final formatted restaurants count:', formattedRestaurants.length);
        console.log('=== END RESTAURANT SEARCH DEBUG ===');

        res.json({
            restaurants: formattedRestaurants,
            total_found: formattedRestaurants.length,
            search_location: { lat: lat, lng: lng, address: geocodeResponse.data.results[0].formatted_address }
        });

    } catch (error) {
        console.error('Restaurant search error:', error);
        res.status(500).json({
            error: 'Failed to search restaurants',
            details: error.message
        });
    }
};

// Park-based restaurant search (for restaurant-selector.html) - NEW PLACES API ONLY
exports.searchRestaurantsNearPark = async (req, res) => {
    try {
        const { latitude, longitude, radius, cuisines, prices, rating } = req.body;
        console.log('=== PARK RESTAURANT SEARCH DEBUG ===');
        console.log('Park search request:', { latitude, longitude, radius, cuisines, prices, rating });

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const searchRadius = parseFloat(radius) || 25000;

        console.log('Parsed coordinates:', { lat, lng, searchRadius });

        // Build search query
        let textQuery = 'restaurants';
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
                    'greek': 'greek restaurant'
                };
                return cuisineMap[c] || (c + ' restaurant');
            });
            textQuery = cuisineQueries.join(' OR ');
        }

        console.log('Search query:', textQuery);

        // Build NEW Places API request
        const searchRequest = {
            textQuery: textQuery,
            locationBias: {
                circle: { 
                    center: { 
                        latitude: lat, 
                        longitude: lng 
                    }, 
                    radius: searchRadius
                }
            },
            pageSize: 20,
            rankPreference: 'RELEVANCE',
            languageCode: 'en'
        };

        // Add price filtering
        if (prices && prices.length > 0) {
            const priceLevels = prices.map(p => {
                const priceMap = {
                    1: 'PRICE_LEVEL_INEXPENSIVE',
                    2: 'PRICE_LEVEL_MODERATE',
                    3: 'PRICE_LEVEL_EXPENSIVE',
                    4: 'PRICE_LEVEL_VERY_EXPENSIVE'
                };
                return priceMap[p] || 'PRICE_LEVEL_INEXPENSIVE';
            });
            searchRequest.priceLevels = priceLevels;
            console.log('Added price levels:', priceLevels);
        }

        console.log('NEW Places API request:', JSON.stringify(searchRequest, null, 2));

        // Make request to NEW Places API
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.types,places.id,places.location,places.businessStatus'
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
        console.log('Places API response places count:', data.places?.length || 0);

        if (!data.places || data.places.length === 0) {
            console.log('No places found, returning empty result');
            return res.json({
                restaurants: [],
                total_found: 0,
                search_center: { lat, lng },
                radius: searchRadius,
                map_bounds: {
                    northeast: { lat: lat + 0.05, lng: lng + 0.05 },
                    southwest: { lat: lat - 0.05, lng: lng - 0.05 }
                }
            });
        }

        // Process restaurants
        let restaurants = data.places;
        console.log('Raw restaurants before filtering:', restaurants.length);

        // Filter by rating if specified
        if (rating && rating > 0) {
            restaurants = restaurants.filter(r => r.rating && r.rating >= rating);
            console.log('After rating filter:', restaurants.length);
        }
        
        // Only include restaurants that have location data (needed for map)
        restaurants = restaurants.filter(r => r.location && r.location.latitude && r.location.longitude);
        console.log('After location filter:', restaurants.length);
        
        // Sort by rating and limit
        restaurants = restaurants
            .filter(r => r.rating && r.rating > 0)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 20);

        console.log('Final restaurants after all filters:', restaurants.length);

        // Format for frontend - FIXED
        const formattedRestaurants = restaurants.map((restaurant, index) => {
            const formatted = {
                name: restaurant.displayName?.text || 'Unknown Restaurant',
                rating: restaurant.rating || 0,
                price_level: mapPriceLevel(restaurant.priceLevel) || 1,
                address: restaurant.formattedAddress || 'Address not available',
                place_id: restaurant.id,
                cuisine_types: restaurant.types?.filter(type => 
                    !['restaurant', 'food', 'establishment', 'point_of_interest'].includes(type)
                ) || [],
                location: {
                    lat: restaurant.location.latitude,
                    lng: restaurant.location.longitude
                },
                business_status: restaurant.businessStatus || 'OPERATIONAL',
                opening_hours: []
            };
            
            // FIXED: Use index instead of formattedRestaurants.length
            if (index < 3) {
                console.log(`Formatted restaurant ${index + 1}:`, {
                    name: formatted.name,
                    location: formatted.location,
                    address: formatted.address
                });
            }
            
            return formatted;
        });

        // Calculate map bounds
        let bounds = {
            northeast: { lat, lng },
            southwest: { lat, lng }
        };

        if (formattedRestaurants.length > 0) {
            const lats = formattedRestaurants.map(r => r.location.lat);
            const lngs = formattedRestaurants.map(r => r.location.lng);
            
            bounds = {
                northeast: {
                    lat: Math.max(...lats, lat),
                    lng: Math.max(...lngs, lng)
                },
                southwest: {
                    lat: Math.min(...lats, lat),
                    lng: Math.min(...lngs, lng)
                }
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
        res.status(500).json({
            error: 'Failed to search restaurants near park',
            details: error.message
        });
    }
};

// Autocomplete endpoint
exports.autocomplete = async (req, res) => {
    try {
        const { input } = req.body;
        if (!input || input.length < 2) { 
            return res.json({ predictions: [] }); 
        }

        const autocompleteRequest = {
            input: input,
            locationRestriction: {
                rectangle: {
                    low: { latitude: -90, longitude: -180 },
                    high: { latitude: 90, longitude: 180 }
                }
            },
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

        if (!response.ok) { 
            throw new Error(`Autocomplete API error: ${response.status} ${response.statusText}`); 
        }
        
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

// Geocoding endpoint
exports.geocode = async (req, res) => {
    try {
        const { location } = req.body;
        if (!location) { 
            return res.status(400).json({ error: 'Location is required' }); 
        }

        const response = await client.geocode({ 
            params: { address: location, key: process.env.GOOGLE_MAPS_API_KEY } 
        });

        if (response.data.results.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }

        const result = response.data.results[0];
        const { lat, lng } = result.geometry.location;

        res.json({ location: { lat: lat, lng: lng, formatted_address: result.formatted_address } });
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({ error: 'Failed to geocode location' });
    }
};

// Health check endpoint
exports.healthCheck = (req, res) => {
    res.json({
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
};

// Map embed URL endpoint
exports.getMapEmbedUrl = async (req, res) => {
    try {
        const { latitude, longitude, zoom } = req.body;
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

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
        res.status(500).json({
            error: 'Failed to generate map embed URL',
            details: error.message
        });
    }
};
# ParkMatch: Backend

Node.js API server that provides national park recommendations and restaurant search functionality.

## What it does
- Takes user preferences and returns personalized national park recommendations
- Searches for restaurants near parks using Google Maps Places API (New)
- Serves park data with weather forecasts and visitor crowd predictions
- Provides geocoding and autocomplete services (does not fully use these endpoints in current version, but could)

## File Structure
### Server
- `server.js` => main express server setup and configuration
- `config/db.js` => database connection configuration

### API Routes  
- `routes/googlemaps.js` => Google Maps API routes
- `routes/parksRoute.js` => national park recommendation routes (NPS API)

### Controllers
- `controllers/googleMapsController.js` => Google Maps Places API integration
- `controllers/parksController.js` => park recommendation logic

### Data Sources
- `data/` => contains processed park, weather, and visitation data
  - `activities_adjusted.json` => activity mappings
  - `topics_adjusted.json` => topic/interest mappings  
  - `monthly_visitation.json` => historical visitor data (monthly, by year)
  - `park_visitation_data.json` => park-specific visitor patterns
  - `parks.json` => complete park database
  - `parks_and_visitation.json` => combined park and visitor data

### Data Compilation Scripts
- `data_compilation_scripts/` => scripts that fetch and process data from APIs; we then stored these in a MongoDB database which we access
  - Fetches park information from National Park Service API
  - Retrieves weather data from weather APIs
  - Processes and combines data for recommendations

### Models
- `models/park.js` => park data model/schema

## Tech Stack
- Node.js + Express
- Google Maps Places API (New version)
- National Park Service API integration
- Weather API integration
- MongoDB for data storage

## Setup
1. Clone the repo
2. `npm install`
3. Set environment variables (Google Maps API key, etc.) [Note: API key not included, you will need to create your own for any APIs]
4. `npm start`

## API Endpoints
- `POST /api/parks/recommendations` => get personalized park recommendations
- `POST /api/restaurants/search-restaurants-near-park` => find restaurants near parks
- `GET /api/config/maps-key` => get Google Maps API key for frontend
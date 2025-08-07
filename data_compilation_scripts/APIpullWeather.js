require('dotenv').config({ path: '../.env' });
const fs = require('fs').promises;
const apiUrl = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/';

async function getParkLocations() {
    const url = '../data/parks.json';
    try {
        const data = await fs.readFile(url,'utf8');
        const parks = JSON.parse(data);
        return parks;
    }
    catch(error) {
        console.error('Error fetching park locations:',error);
    }
}

function delayFetch() {
    return new Promise(resolve => setTimeout(resolve,15000));
}

async function getAllWeatherData() {
    var weatherData = [];
    const parks = await getParkLocations();
    try {
        for (const park of parks) {
            //const response = await fetch(`${apiUrl}${park.latitude},${park.longitude}/2021-01-01/2025-07-31?key=${process.env.VISUAL_CROSSING_API_KEY}&include=days&unitGroup=us`);
            const response = await fetch(`${apiUrl}${park.latitude},${park.longitude}/2021-01-01/2025-07-31?key=${process.env.VISUAL_CROSSING_API_KEY}&include=days&unitGroup=us&elements=datetime,temp,humidity,precip`);
            if (!response.ok) {
                throw new Error(`Unable to retrieve data with an error code of ${response.status}.`);
            }
            const results = await response.json();
            results.fullName = park.fullName;
            results.parkCode = park.parkCode;
            weatherData.push(results);
            console.log(`Weather data for ${park.parkCode} was retrieved successfully!`)
            await delayFetch();
        }
        console.log('All park data fetched correctly!');
        return weatherData;
    }
    catch (error) {
        console.error('Error fetching weather data on ALL parks: ',error);
    }
}

async function writeToServer(data,url) {
    json = JSON.stringify(data,null,2);

    await fs.writeFile(url,json,(err) => {
        if (err) {
            console.error('Writing bulk weather data to server failed: ');
            return;
        }
        console.log('Bulk weather data written to server successfully.')
    })
}

(async () => {
    try {
        const weatherData = await getAllWeatherData();
        //await writeToServer(weatherData,'../data/bulkParkWeatherData.json');
        await writeToServer(weatherData,'../data/rawParkWeatherData.json');
    }
    catch (error) {
        console.error('Error: ',error);
    }
})();

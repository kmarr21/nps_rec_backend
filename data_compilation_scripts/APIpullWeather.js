const apiUrl = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/';
const apiKey = 'BWDFWVAYDWXRTMTKCV3WEGD53';

async function getParkLocations() {
    const url = 'https://github.com/kmarr21/nps_rec_backend/tree/main/data/parks.json';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Unable to retrieve data with an error code of ${response.status}.`);
        }

        const data = await response.json();
        return data;
    }
    catch(error) {
        console.error('Error fetching park locations:',error);
    }
}

async function getParkWeatherData(park) {
    try {
        const response = await fetch(`${apiUrl}${park.latitude},${park.longitude}/2021-01-01/2025-07-30?key=${apiKey}&include=days`);
        if (!response.ok) {
            throw new Error(`Unable to retrieve data with an error code of ${response.status}.`);
        }

        const data = await response.json();
        data.parkName = park.fullName;
        return data;
    }
    catch {
        console.error(`Error fetching weather for ${park.fullName}: `,error);
        return null;
    }
}

async function getAllWeatherData() {
    const parks = await getParkLocations();
    const weatherPromise = parks.map(park => getParkWeatherData(park));

    try {
        const results = await Promise.all(weatherPromise);
        console.log('All park data fetched correctly!');
        return results;
    }
    catch (error) {
        console.error('Error fetching weather data on ALL parks: ',error);
    }
}

const fs = require('fs');

function writeToServer(data) {
    json = JSON.stringify(data,null,2);

    fs.writeFile('../data/bulkParkWeatherData.json',json,(err) => {
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
        writeToServer(weatherData);
    }
    catch (error) {
        console.error('Error: ',error);
    }
})();

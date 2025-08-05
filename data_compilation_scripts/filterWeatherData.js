const fs = require('fs').promises;

async function getBulkWeatherData() {
    const url = '../data/rawParkWeatherData.json';
    try {
        const data = await fs.readFile(url,'utf8');
        const parks = JSON.parse(data);
        return parks;
    }
    catch(error) {
        console.error('Error fetching park locations:',error);
    }
}

function getWeekAverages(data,stat,rounding) {
    let arrayOfYears = Array.from( { length:5 }, () => []);
    const years = [2021,2022,2023,2024,2025];
    years.forEach((year,index) => {
        for (let day of data) {
            if (day.datetime.includes(year)) {
                arrayOfYears[index].push(day[stat]);
            }
        }
    });

    let arrayOfWeeks = parseIntoArrayOfWeeks(arrayOfYears,rounding);
    let averages = arrayOfWeeks.map((elt) => { return getAverage(elt,rounding) });
    return averages;
}

function parseIntoArrayOfWeeks(data,rounding) {
    let result = Array.from( { length:52 }, () => []);
    let currWeek = 0
    for (let i = 0; i < data.length; i++) {
        while (data[i].length !== 0) {
            let deleteCount = 7;
            if (i == 3 && currWeek == 9) {
                deleteCount = 8;
            }
            let week = [];
            if (currWeek < 51) {
                week = getAverage(data[i].splice(0,deleteCount),rounding);
            }
            else {
                week = getAverage(data[i].splice(0,data[i].length),rounding);
            }
            result[currWeek].push(week);
            currWeek++;
        }
        currWeek = 0;
    }
    return result;
}

function getAverage(array,rounding) {
    sum = 0;
    for (let i = 0; i < array.length; i++) {
        sum += array[i];
    }
    average = sum / array.length;

    roundedAverage = parseFloat(average.toFixed(rounding));
    return roundedAverage;
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
        const weatherData = await getRawWeatherData(); //Array of parks
        var averages = [];
        
        for (const park of weatherData) {
            const tempAve = getWeekAverages(park.days,'temp',1);
            const humidityAve = getWeekAverages(park.days,'humidity',1);
            const precipAve = getWeekAverages(park.days,'precip',3);
            const parkData = {
                parkCode: park.parkCode,
                parkName: park.fullName,
                temperature: tempAve,
                humidity: humidityAve,
                precipitation: precipAve
            };
            averages.push(parkData);
        }
        await writeToServer(averages,'../data/filteredParkWeatherData.json');
    }
    catch (error) {
        console.error('Error: ',error);
    }
})();

//NPS API pull for NPS Park Finder

//Takes all park data from NPS API and then filters out everything but 
//the 63 National Parks

//Fetch function with iteration for limit
async function getNPParks() {
    //starting record
    let start = 0;
    //number of records allowed to be pulled
    let limit = 50;
    //allParks array
    let allParks = [];
    //api key
    APIKEY = "addkey";
    let hasMore = true;

    while (hasMore) {
        const url = `https://developer.nps.gov/api/v1/parks?limit=50&start=${start}&api_key=${APIKEY}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch data');

            const data = await response.json();

            //Concatentate arrays, not push because that would lead to nested array
            allParks = allParks.concat(data.data);

            //Iterate
            const total = data.total;
            start += limit;
            if (start >= total) {
                hasMore = false;
            }
        } catch (error) {
            console.error('Error', error);
            hasMore = false;
        }
    }

    //Ensure all parks fetched
    console.log('Parks fetched: ', allParks.length);

    //Filter out non-NP data
    const nationalParksOnly = allParks.filter(p =>
        p.fullName.includes('National Park')
    );

    //Confirm filtering (value = 63)
    console.log('Filtered National Parks: ', nationalParksOnly.length);

    return nationalParksOnly;
}

//fs module
const fs = require('fs');

//Output json file
function output(array) {
    NPjson = JSON.stringify(array, null, 2);

    fs.writeFile('parks2.json', NPjson, (err) => {
        if (err) {
            console.error('Error writing to file: ', err);
            return;
        }
        console.log('Data written to file.')
    })
}

//Function calls
(async () => {
    try {
        const NParray = await getNPParks();
        output(NParray);
    } catch (error) {
        console.error('Error: ', error);
    }
})();











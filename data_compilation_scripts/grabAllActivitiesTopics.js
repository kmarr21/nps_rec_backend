//Acquire list of all unique activities from parks.json

const fs = require('fs');

const readIn = 'parks.json';

//Read in parks data
rawData = fs.readFileSync(readIn, (err, data) => {
    if (err) {
        console.error('Error reading file: ', err);
        return;
    }
    console.log('File content: ', data);
    return data;
});

//Parse data
const parksData = JSON.parse(rawData);

//Array for activities
activitiesArray = [];

//Array for topics
topicsArray = [];

//Iterate through each park, add unique activities and topics
parksData.forEach(park => {
    if ('activities' in park) {
        park.activities.forEach(activity => {
            if (!(activitiesArray.includes(activity.name))) {
                activitiesArray.push(activity.name);
            }
        })
    }

    if ('topics' in park) {
        park.topics.forEach(topic => {
            if (!(topicsArray.includes(topic.name))) {
                topicsArray.push(topic.name);
            }
        })
    }
});

//Ensure activities and topics pulled
console.log(activitiesArray);
console.log(topicsArray);

//Write to files
activitiesString = JSON.stringify(activitiesArray, null, '\t');
topicsString = JSON.stringify(topicsArray, null, '\t');


fs.writeFile('activities.json', activitiesString, (err) => {
    if (err) {
        console.error('Error writing to file: ', err);
        return;
    }
    console.log('Data written to file.');
});

fs.writeFile('topics.json', topicsString, (err) => {
    if (err) {
        console.error('Error writing to file: ', err);
        return;
    }
    console.log('Data written to file.');
});
const Park = require('../models/park');
const mongoose = require('mongoose');

//Finds the week of the year that 'date' is in. First week of the year would return a value of '0'.
function getWeekOfYear(date) {
    let currDate = new Date(date);
    let startOfYearDate = new Date(currDate.getFullYear(), 0, 1);
    //Gives us the number of millliseconds from the beginning of the year to the date given as input
    let timeDiff = currDate.getTime() - startOfYearDate.getTime();
    //Gives us the day of the year for currDate
    let dayOfYear = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
    let weekOfYear = Math.floor(dayOfYear / 7);
    //Accounts for fact that there are more than 52 weeks a year, technically
    if (weekOfYear > 51) weekOfYear = 51;
    return weekOfYear;
}

//Reads form from user to ogranize inputs as an array of parameters.
// Returns result = {
//              weeksCovered,
//              activities,
//              topics,
//              climate,
//              crowds
//         }
function readParameters(params) {
    var result = {};

    //Get an array of the weeks of the year that will be covered by this trip
    var weeksOfYear = [];
    var startWeek = getWeekOfYear(params.startDate);
    var endWeek = getWeekOfYear(params.endDate);
    for (let i = startWeek; i <= endWeek; i++) {
        weeksOfYear.push(i);
    }
    result.startDate = params.startDate;
    result.endDate = params.endDate;
    result.weeksCovered = weeksOfYear;

    //Assign activities array as direct parameter
    result.activities = params.activities;

    //Account for fact that topics may not have been chosen by user
    if (params.topics.length !== 0) result.topics = params.topics;
    else result.topics = null;

    //Use a numerical value to signify the inputs for climate and crowds.
    //Numerical code for climate.
    if (params.climate === 'no preference') result.climate = null;
    else if (params.climate === 'cool/cold') result.climate = 0;
    else if (params.climate === 'mild') result.climate = 1;
    else result.climate = 2;
    //Numerical code for crowds.
    if (params.crowds === 'want solitude') result.crowds = 0;
    else if (params.crowds === 'moderate crowds') result.crowds = 1;
    else result.crowds = 2;

    return result;
}

//Gets the similarity score for an individual park when compared to the parameter values from the user form.
function getSimilarityScore(park, params) {
    let sum = 0;

    sum += getActivitiesTopicScore(park, params.activities, 'activities');
    if (params.topics !== null) sum += getActivitiesTopicScore(park, params.topics, 'topics');
    if (params.climate !== null) sum += getClimateScore(park.weather.temperature, params.weeksCovered, params.climate);
    sum += getCrowdScore(park, params.startDate, params.endDate, params.crowds);

    return sum;
}

//Calculates a park score for any array type inputs by the user (either activities or topics)
function getActivitiesTopicScore(park, param, type) {
    //Get the number of activities/topics selected by user
    let numSelectedByUser = param.length;
    var parkList = [];

    //Filter the name field of activities or topics its own array
    var list;
    if (type === 'activities') list = park.activities;
    else if (type === 'topics') list = park.topics;

    for (const element of list) {
        parkList.push(element.name);
    }

    //Check to see how many items picked by the user are a match for the specific park
    var matchingSum = 0;
    for (const element of param) {
        if (parkList.includes(element)) matchingSum++;
    }

    //Quantify the items picked by the user into a score on a scale of 1-10
    let score = matchingSum / numSelectedByUser;
    return parseFloat(score.toFixed(2));
}

//Calculates a park score for how closely it will resemble the preferred climate during the time of travel
function getClimateScore(parkTemps, tripLength, climateVal) {
    //Calculate the average temp for this park given the date range for the trip
    var tempSum = 0;
    for (let i = 0; i < tripLength.length; i++) {
        tempSum += parkTemps[tripLength[i]];
    }
    let tempAverage = tempSum / tripLength.length;
    var roundedTempAverage = parseFloat(tempAverage.toFixed(1));
    //Limiting temp average to be between 0 and 100 degrees
    if (roundedTempAverage < 0) roundedTempAverage = 0;
    if (roundedTempAverage > 100) roundedTempAverage = 100;

    //User prefers a below 55 degree temp
    if (climateVal == 0) {
        if (roundedTempAverage <= 55) return 1;
        else {
            score = 1 - ((roundedTempAverage - 55) / 45);
            return parseFloat(score.toFixed(6));
        }
    }
    //User prefers a 55 - 75 degree temp
    else if (climateVal == 1) {
        if (roundedTempAverage >= 55 && roundedTempAverage <= 75) return 1;
        else if (roundedTempAverage < 55) {
            score = roundedTempAverage / 55;
            return parseFloat(score.toFixed(6));
        }
        else {
            score = 1 - ((roundedTempAverage - 75) / 25);
            return parseFloat(score.toFixed(6));
        }
    }
    //User prefers an above 75 temp
    else {
        if (roundedTempAverage >= 75) return 1;
        else {
            score = roundedTempAverage / 75;
            return parseFloat(score.toFixed(6));
        }
    }
}

//Calculates a park score for how closely it will resemble the preferred crowds during the time of travel
function getCrowdScore(park, startDate, endDate, crowdVal) {
    //Calculate the average crowd for this park given the date range for the trip
    let start = new Date(startDate);
    var startMonth = start.getMonth();
    let end = new Date(endDate);
    var endMonth = end.getMonth();
    var crowdSum = 0;
    for (let i = startMonth; i <= endMonth; i++) {
        let index = String(i);
        crowdSum += park.visitation[0][index];
    }
    let crowdAverage = Math.floor(crowdSum / (endMonth - startMonth + 1));
    //Limiting temp average to be between 0 and 1,000,000 people
    if (crowdAverage > 1000000) crowdAverage = 1000000;

    //User prefers parks with no crowd
    if (crowdVal == 0) {
        score = 1 - (crowdAverage / 1000000);
        return parseFloat(score.toFixed(6));
    }

    //User prefers a park with a medium size crowd
    else if (crowdVal == 1) {
        if (crowdAverage < 500000) {
            score = crowdAverage / 500000;
            return parseFloat(score.toFixed(6));
        }
        else if (crowdAverage > 500000) {
            score = 1 - ((crowdAverage - 500000) / 500000);
            return parseFloat(score.toFixed(6));
        }
        else return 1;
    }

    //User prefers parks with a large crowd
    else {
        score = crowdAverage / 1000000;
        return parseFloat(score.toFixed(6));
    }
}

//Get park data
exports.getFiveParks = async (req, res) => {
    try {
        console.log('getFiveParks controller hit');
        mongoose.set('debug', true);
        const parks = await Park.find().limit(10).select('activitites description fullName images latitude longitude parkCode topics visitation weather');
        res.json(parks);
    } catch (error) {
        console.error("Error fetching parks: ", error);
        res.status(500).json({ error: 'failed to fetch five parks' });
    }
};

exports.getRecommendedParks = async (req, res) => {
    try {
        console.log('Survey data received:', req.body);
        mongoose.set('debug', true);

        const params = readParameters(req.body);
        
        var query;
        if (params.topics !== null) {
            query = {
                $or: [
                    { 'activities.name': { $in: params.activities } },
                    { 'topics.name': { $in: params.topics } }
                ]
            };
        }
        else {
            query = { 'activities.name': { $in: params.activities } };
        }
        const parks = await Park.find(query).select('activitities description fullName images latitude longitude parkCode topics visitation weather').toArray();

        var similarityRank = [];
        for (const park of parks) {
            parkScore = {};
            parkScore.parkInfo = park;
            parkScore.similarityScore = getSimilarityScore(park, params);
            similarityRank.push(parkScore);
        }

        similarityRank.sort((a, b) => b.similarityScore - a.similarityScore);

        var recommendedParks = [];
        for (let i = 0; i < similarityRank.length && i < 10; i++) {
            recommendedParks.push(similarityRank[i].parkInfo);
        }

        console.log(recommendedParks);
        res.json(recommendedParks);
    } catch (error) {
        console.error("Error fetching parks: ", error);
        res.status(500).json({ error: 'failed to fetch parks' });
    }
};
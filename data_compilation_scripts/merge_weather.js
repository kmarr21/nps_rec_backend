//Mongo module
const MongoClient = require('mongodb').MongoClient;
const fs = require('fs');
require('dotenv').config({ path: '/Users/abbyshroba/Documents/CS120/FinalProject/nps_rec_backend/.env' });

//url from mongodb
const url = process.env.MONGODB_URI;

console.log("Here");

async function main() {

    try {
        const client = await MongoClient.connect(url);
        console.log("Connected to Mongo");

        const dbo = client.db("NPS");
        const parks = dbo.collection("parksWithVisitation");

        const pipeline = [
            {
                $lookup: {
                    from: "weather_NPS",
                    localField: "parkCode",
                    foreignField: "parkCode",
                    as: "weatherData"
                }
            },
            {
                $unwind: {
                    path: "$weatherData",
                    preserveNullAndEmptyArrays: true,
                }
            },
            {
                $set: {
                    weather: {
                        temperature: "$weatherData.temperature",
                        humidity: "$weatherData.humidity",
                        precipitation: "$weatherData.precipitation"
                    }
                }
            },
            {
                $unset: "weatherData"
            },
            {
                $merge: {
                    into: "parksAllData",
                    whenMatched: "merge",
                    whenNotMatched: "insert"
                }
            },
        ];

        try {
            await parks.aggregate(pipeline).toArray();
        } catch (err) {
            console.error('Aggregation error: ', err);
        }

        client.close();

    } catch (err) {
        console.error("Connection failed: ", err);
    }
}

main();
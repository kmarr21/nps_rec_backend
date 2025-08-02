//Mongo module
const MongoClient = require('mongodb').MongoClient;
const fs = require('fs');
require('dotenv').config();

//url from mongodb
const url = process.env.MONGODB_URI;

async function main() {

    try {
        const client = await MongoClient.connect(url);
        console.log("Connected to Mongo");

        const dbo = client.db("NPS");
        const collection = dbo.collection("parks_visitation");

        const pipeline = [
            {
                //Unwind month arrays
                $unwind: {
                    path: "$monthly",
                    includeArrayIndex: "monthIndex"
                }
            },
            {
                //Group by parkcode and month index to calculate
                $group: {
                    _id: {
                        parkCode: "$parkCode",
                        month: "$monthIndex"
                    },
                    //Calculate average visits per month
                    avgVisits: { $avg: "$monthly.totalVisits" }
                }
            },
            {
                //Project rounded average visits
                $project: {
                    _id: 1,
                    roundedAvgVisits: { $round: ["$avgVisits", 0] }
                }
            },
            {
                //Regroup by parkcode and create monthly averages array per park
                $group: {
                    _id: "$_id.parkCode",
                    monthlyAverages: {
                        $push: {
                            k: { $toString: "$_id.month" },
                            v: "$roundedAvgVisits"
                        }
                    }
                }
            },
            {
                //Final projection 
                $project: {
                    _id: 0,
                    parkCode: "$_id",
                    monthlyAverages: { $arrayToObject: "$monthlyAverages" }
                }
            }
        ];

        try {
            //Aggregate data according to pipeline above
            const results = await collection.aggregate(pipeline).toArray();
            //Create string
            monthlyVisitation = JSON.stringify(results, null, 2);

            //Write string to json file
            fs.writeFile('monthly_visitation.json', monthlyVisitation, (err) => {
                if (err) {
                    console.error('Error writing to file: ', err);
                    return;
                }
                console.log('Data written to file.');
            });
        } catch (err) {
            console.error('Aggregation error: ', err);
        }
        //Close connection
        client.close();

    } catch (err) {
        console.error("Connection failed: ", err);
    }
}

//Run main function
main();
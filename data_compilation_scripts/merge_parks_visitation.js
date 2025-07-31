//Mongo module
const MongoClient = require('mongodb').MongoClient;
const fs = require('fs');

//url from mongodb
const url = "Add Mongo URL";

console.log("Here");

async function main() {

    try {
        const client = await MongoClient.connect(url);
        console.log("Connected to Mongo");

        const dbo = client.db("NPS");
        const parks = dbo.collection("parks");

        const pipeline = [
            {
                $lookup: {
                    from: "monthly_visitation",
                    localField: "parkCode",
                    foreignField: "parkCode",
                    as: "visitation"
                }
            },
            {
                $set: {
                    visitation: "$visitation.monthlyAverages"
                }
            },
            {
                $merge: {
                    into: "parksWithVisitation",
                    whenMatched: "merge",
                    whenNotMatched: "insert"
                }
            },
        ];

        try {
            await parks.aggregate(pipeline).toArray();

            const parksAndVisitation = await dbo.collection('parksWithVisitation').find({}).toArray();

            const jsonStr = JSON.stringify(parksAndVisitation, null, 2);

            fs.writeFile('parks_and_visitation.json', jsonStr, (err) => {
                if (err) {
                    console.error('Error writing to file: ', err);
                    return;
                }
                console.log('Data written to file.');
            });
        } catch (err) {
            console.error('Aggregation error: ', err);
        }

        client.close();

    } catch (err) {
        console.error("Connection failed: ", err);
    }
}

main();
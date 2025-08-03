// Example: Express.js backend to receive data
const express = require('express');
const app = express();
const port = 3000;

// Middleware to parse JSON body
app.use(express.json());

app.post('/api/submit-data', (req, res) => {
    const receivedData = req.body; // Access the data sent from the frontend
    console.log('Received data:', receivedData);

    res.status(200).json({ message: 'Data received successfully!' });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
const express = require('express');
const app = express();
const PORT = 4000; // You can use any port

app.use(express.json());

app.post('/', (req, res) => {
    // Print the received log
    console.log('Received log from webhook:', req.body.log);
    res.status(200).json({ message: 'Log received' });
});

app.listen(PORT, () => {
    console.log(`Webhook receiver listening on port ${PORT}`);
});
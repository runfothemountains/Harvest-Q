// index.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello from Harvest!');
});

// Bind to the port provided by Cloud Run / buildpack
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});



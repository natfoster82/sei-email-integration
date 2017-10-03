const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const config = require('./config.json');


// Express
const express = require('express');
var app = express();

// App settings
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('./api'));

// https settings
const httpsOptions = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
};

// Start server
var httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(8443, function () {
    console.log('started server on 8443');
});

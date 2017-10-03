'use strict';

const https = require('https');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config.json');
var app = express();


app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('./api'));

const httpsOptions = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
};

var httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(8443, function () {
    console.log('started server on 8443');
});

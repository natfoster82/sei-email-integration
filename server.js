const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const config = require('./config');


// Express
const express = require('express');
var app = express();

// App settings
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('./api'));

app.listen(8443, function () {
    console.log('started server on 8443');
});

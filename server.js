const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const config = require('./config');


// Express
const express = require('express');
var app = express();

// App settings
app.set('port', (process.env.PORT || 8444));
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('./api'));

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});

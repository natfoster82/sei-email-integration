'use strict';

const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const config = require('./config.json');
const mailer = require('express-mailer');
var PersistentStorage = require('./repository');

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('./api'));

mailer.extend(app, {
    from: config.MAIL_USERNAME,
    host: config.MAIL_SERVER,
    secureConnection: false,
    port: 587,
    transportMethod: 'SMTP',
    auth: {
        user: config.MAIL_USERNAME,
        pass: config.MAIL_PASSWORD
    }
});

var db = new PersistentStorage();

const httpsOptions = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
};
var httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(8443, function () {
    console.log('started server on 8443');
});

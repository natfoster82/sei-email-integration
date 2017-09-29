const express = require('express');
const https = require('https');
const fs = require('fs');
const app = express();
const bodyParser = require('body-parser');
const config = require('./config.json');
const request = require('request');
const jwt = require('jsonwebtoken');
var PersistentStorage = require('./repository');


app.set('view engine', 'ejs');
app.use(bodyParser.json());

var db = new PersistentStorage();

app.get('/', function (req, res) {
    res.render('pages/index', { seiBase: config.SEI_BASE, caveonId: config.SEI_ID });
});

app.get('/authorize', function (req, res) {
    console.log(req.query);
    var integrationId = req.query.integration_id;
    if (!integrationId) {
        res.sendStatus(400);
    }

    request.get(config.SEI_BASE + '/api/integrations/' + integrationId + '/credentials', 
        { 'auth': { 'user': config.SEI_ID, 'pass': config.SEI_SECRET } },
        function (error, response, body) {
            if (error || response.statusCode >= 400) {
                res.send(error);
            }

            var integrationInfo = JSON.parse(body);
            db.set(integrationInfo.exam_id, integrationInfo);

            res.redirect(config.SEI_BASE);
        }
    );
});

app.get('/main', function (req, res) {
    var examId = req.query.exam_id;
    var token = req.query.jwt;
    db.get(examId).then(function (integrationInfo) {
        try {
            jwt.verify(token, integrationInfo.secret);
        } catch (e) {
            
        }
        res.render('pages/main');
    });
});


const httpsOptions = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
};
var httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(8443, function () {
    console.log('started server on 8443');
});

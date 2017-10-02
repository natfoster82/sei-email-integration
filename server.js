const express = require('express');
const https = require('https');
const fs = require('fs');
const app = express();
const bodyParser = require('body-parser');
const config = require('./config.json');
const request = require('request');
const jwt = require('jsonwebtoken');
const mailer = require('express-mailer');
var PersistentStorage = require('./repository');

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

app.get('/', function (req, res) {
    res.render('pages/splash', { seiBase: config.SEI_BASE, caveonId: config.SEI_ID });
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

            res.render('pages/integrationSuccess');
        }
    );
});

app.get('/main', function (req, res) {
    var examId = req.query.exam_id;
    var token = req.query.jwt;
    if (!examId || !token) {
        res.sendStatus(500);
    }

    db.get(examId).then(function (integrationInfo) {
        try {
            jwt.verify(token, integrationInfo.secret);
            request.get(config.SEI_BASE + '/api/exams/' + integrationInfo.exam_id + '?include=settings',
            { 'auth': { 'bearer': integrationInfo.token } }, function (error, response, body) {
                var exam = JSON.parse(body);
                var examineeSchema = exam.settings.examinee_schema;
                console.log('exam', examineeSchema);
                res.render('pages/main', { examineeSchema: examineeSchema });
            });
        } catch (e) {
            console.log(e);
            res.sendStatus(500);
        }
    });
});

app.post('/main', function (req, res) {
    var examId = req.query.exam_id;
    var token = req.query.jwt;

    if (!examId || !token) {
        res.sendStatus(500);
    }

    db.get(examId).then(function (integrationInfo) {
        try {
            jwt.verify(token, integrationInfo.secret);
            var examineeInfos = [];
            var keys = Object.keys(req.body);
            for (var i = 0; i < req.body.emails.length; i++) {
                var info = {};
                var email = null;
                for (var j = 0; j < keys.length; j++) {
                    var currentKey = keys[j];
                    if (currentKey === 'emails') {
                        email = req.body[currentKey][i];
                    } else {
                        info[currentKey] = req.body[currentKey][i];
                    }
                }
                
                var deliveryPostData = {
                    'method': 'POST',
                    'headers': {
                        'Authorization': 'Bearer ' + integrationInfo.token
                    },
                    'url': config.SEI_BASE + '/api/exams/' + integrationInfo.exam_id + '/deliveries',
                    'json': { 'examinee_info' : info }
                };
                createDelivery(deliveryPostData, email);
                examineeInfos.push(info);
            }
            res.render('pages/emailSuccess');
        } catch (e) {
            console.log(e);
            res.sendStatus(500);
        }
    });
});

function createDelivery(deliveryPostData, email) {
    request(deliveryPostData, function (error, response, body) {
        var takeUrl = String(config.TAKE_URL + '?launch_token=' + body.launch_token);
        console.log('send email to:', email);
        console.log('with content:', takeUrl);

        app.mailer.send('emails/deliveryLink', {
            to: email,
            subject: 'New Delivery',
            deliveryLink: takeUrl
        }, function (err) {
            if (err) {
                // handle error 
                console.log(err);
            }
            console.log('Email Sent');
        });
    });
}


const httpsOptions = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
};
var httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(8443, function () {
    console.log('started server on 8443');
});

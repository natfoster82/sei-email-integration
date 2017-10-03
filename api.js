const config = require('./config.json');
const express = require('express');
var app = express();
const request = require('request');
const jwt = require('jsonwebtoken');
const qlimit = require('qlimit');
var PersistentStorage = require('./repository');
const Q = require('q');
var mailer = require('express-mailer');


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

var limit = qlimit(10);
var db = new PersistentStorage();

app.get('/', function (req, res) {
    res.render('pages/splash', { seiBase: config.SEI_BASE, caveonId: config.SEI_ID });
});

app.get('/authorize', function (req, res) {
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
                res.render('pages/main', { examineeSchema: examineeSchema });
            });
        } catch (e) {
            console.log(e);
            res.status(500).send(e);
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
            var keys = Object.keys(req.body);
            var tasks = [];
            for (var i = 0; i < req.body.email.length; i++) {
                var info = {};
                var email = null;
                for (var j = 0; j < keys.length; j++) {
                    var currentKey = keys[j];
                    if (currentKey === 'email') {
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
                tasks.push([email, deliveryPostData]);
            }

            Q.all(tasks.map(limit(function (tup) {
                return createDeliveryAndEmailLink(tup[0], tup[1]);
            })));

            res.render('pages/emailSuccess');
        } catch (e) {
            res.status(500).send(e);
        }
    });
});

function createDeliveryAndEmailLink(email, data) {
    console.log(email, data);
    request(data, function (error, response, body) {
        var takeUrl = String(config.TAKE_URL + '?launch_token=' + body.launch_token);
        app.mailer.send('emails/deliveryLink', {
            to: email,
            subject: 'New Delivery',
            deliveryLink: takeUrl
        }, function () {
            console.log('Done');
        });
    });
}


module.exports = app;

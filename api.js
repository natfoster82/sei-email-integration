const config = require('./config');
const request = require('request');
const jwt = require('jsonwebtoken');
const Q = require('q');


// Database
var PersistentStorage = require('./repository');
var db = new PersistentStorage(getIntegrationInfo);

// Express
const express = require('express');
var app = express();

// Mail client
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

// Concurrency limiter
const qlimit = require('qlimit');
var limit = qlimit(10);


// API routes
// splash page
app.get('/', function (req, res) {
    res.render('pages/splash', { seiBase: config.SEI_BASE, caveonId: config.SEI_ID });
});

// called when returning from SEI integration page
// saves integration credentials
app.get('/authorize', function (req, res) {
    var confirmToken = req.query.confirm_token;
    if (!confirmToken) {
        res.sendStatus(400);
    }

    confirmIntegration(confirmToken).then(function (integrationInfo) {
        db.set(integrationInfo.exam_id, integrationInfo);
        res.render('pages/integrationSuccess');
    });
});

// full page SEI app
// form for entering emails and examinee info
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
                var emailKey = undefined;
                var examineeSchema = exam.settings.examinee_schema;
                for (var i = 0; i < examineeSchema.length; i++) {
                    if (examineeSchema[i].key === 'email' ||
                        examineeSchema[i].key === 'Email') {
                            emailKey = examineeSchema[i].key;
                            examineeSchema.splice(i, 1);
                            break;
                    }
                }
                res.render('pages/main', { examineeSchema: examineeSchema, examName: exam.name, emailKey: emailKey, examDescription: exam.settings.description });
            });
        } catch (e) {
            res.status(500).send(e);
        }
    });
});

// save examinee info and kickstart emails
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
                for (var j = 0; j < keys.length; j++) {
                    var currentKey = keys[j];
                    if (currentKey === 'email') {
                        info[req.body.emailKey] = req.body[currentKey][i];
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
                tasks.push([info[req.body.emailKey], deliveryPostData]);
            }
            Q.all(tasks.map(limit(function (tup) {
                return createDeliveryAndEmailLink(tup[0], tup[1], req.body.examName, req.body.examDescription);
            })));

            res.render('pages/emailSuccess');
        } catch (e) {
            res.status(500).send(e);
        }
    });
});

// create delivery and send email links
function createDeliveryAndEmailLink(email, data, examName, examDescription) {
    request(data, function (error, response, body) {
        var takeUrl = String(config.TAKE_URL + '?launch_token=' + body.launch_token);
        app.mailer.send('emails/deliveryLink', {
            to: email,
            subject: examName + ': Launch Exam',
            deliveryLink: takeUrl,
            examName: examName,
            examDescription: examDescription
        }, function () {
            console.log('Done');
        });
    });
}


function confirmIntegration(confirmToken) {
    var deferred = Q.defer();
    request.get(config.SEI_BASE + '/api/integrations/confirm/' + confirmToken,
        { 'auth': { 'user': config.SEI_ID, 'pass': config.SEI_SECRET } },
        function (error, response, body) {
            if (error || response.statusCode >= 400) {
                deferred.reject(false);
            }

            deferred.resolve(JSON.parse(body));
        }
    );
    return deferred.promise;
}


function getIntegrationInfo(examId) {
    var deferred = Q.defer();
    request.get(config.SEI_BASE + '/api/integrations/' + examId + '/credentials', 
        { 'auth': { 'user': config.SEI_ID, 'pass': config.SEI_SECRET } },
        function (error, response, body) {
            if (error || response.statusCode >= 400) {
                deferred.reject(false);
            }

            deferred.resolve(JSON.parse(body));
        }
    );
    return deferred.promise;
}


module.exports = app;

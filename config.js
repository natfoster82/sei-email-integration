const fs = require('fs');
if (fs.existsSync('config.json')) {
    const configObj = require('./config.json');
    for (var key in configObj) {
        if (configObj.hasOwnProperty(key)) {
            process.env[key] = configObj[key];
        }
    }

}

var config = {
    "SEI_ID": process.env.SEI_ID,
    "SEI_SECRET": process.env.SEI_SECRET,
    "SEI_BASE": process.env.SEI_BASE,
    "TAKE_URL": process.env.TAKE_URL,
    "MAIL_SERVER": process.env.MAIL_SERVER,
    "MAIL_USERNAME": process.env.MAIL_USERNAME,
    "MAIL_PASSWORD": process.env.MAIL_PASSWORD
};

module.exports = config;
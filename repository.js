const Q = require('q');


var PersistentStorage = function PersistentStorage() {
    var redis = require("redis");
    this.client = redis.createClient();
};

PersistentStorage.prototype.set = function set(key, data) {
    var dataAsStr = JSON.stringify(data);
    this.client.set(key, dataAsStr);
};

PersistentStorage.prototype.get = function get(key) {
    var deferred = Q.defer();
    this.client.get(key, function (err, dataAsStr) {
        console.log(err);
        if (err && !dataAsStr) {
            deferred.reject();
        }
        deferred.resolve(JSON.parse(dataAsStr));
    });
    return deferred.promise;
};

module.exports = PersistentStorage;

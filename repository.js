const Q = require('q');


var PersistentStorage = function PersistentStorage(tryAgainFn) {
    var redis = require("redis");
    this.client = redis.createClient();
    this.tryAgainFn = tryAgainFn;
};

PersistentStorage.prototype.set = function set(key, data) {
    var dataAsStr = JSON.stringify(data);
    this.client.set(key, dataAsStr);
};

PersistentStorage.prototype.get = function get(key) {
    var deferred = Q.defer();
    var self = this;
    this.client.get(key, function (err, dataAsStr) {
        if (dataAsStr) {
            deferred.resolve(JSON.parse(dataAsStr));
        } else {
            self.tryAgainFn(key).then(function (data) {
                deferred.resolve(data);
            });
        }
    });
    return deferred.promise;
};

module.exports = PersistentStorage;

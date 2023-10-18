const sqlite3 = require('sqlite3').verbose();

// main part of get() and all() are pretty much the same,
// so we are using a general function for both
function typedGet(type, db, sql, params, callback) {
    const func = type === 'get' ? db.get : db.all;
    return new Promise(resolve => {
        func(sql, params, (err, result) => {
            if(callback) callback(err, result)
            else if(err) throw err;
            resolve(result);
        })
    })
}

exports.get = function(db, sql, params = [], callback = null) {
    return typedGet('get', db, sql, params, callback);
}

exports.all = function(db, sql, params = [], callback = null) {
    return typedGet('all', db, sql, params, callback);
}

exports.run = function(db, sql, params = [], callback = null) {
    return new Promise(resolve => {
        // we might use value of this, which need the old-style function in ES5
        db.run(sql, params, function(err) {
            if(callback) callback(err, this);
            else if(err) throw err;
            resolve(this);
        })
    })
}

exports.open = function(path, 
    mode = sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX, 
    callback = null) {

    return new Promise(resolve=>{
        const db = new sqlite3.Database(
            path, mode, err => {
                if(callback) callback(err);
                else if(err) throw err;
                resolve(db);
            }
        );
    })
}

exports.close = function(db, callback = null) {
    return new Promise(resolve => {
        db.close(err => {
            if(callback) callback(err);
            else if(err) throw err;
            // if we got error, we either callback it or throw it,
            // thus the final result received by resolve() is always true
            resolve(true);
        })
    })
}
const OneYear = 365 * 24 * 60 * 60 * 1000;
const crypto = require('crypto')

exports.calculateStrHash = function(str) {
    return crypto.createHash('md5').update(str).digest('hex')
}

exports.calculateExpDate = function(requestDate) {
    return `${requestDate + OneYear}`;
}

exports.send403 = function(response) {
    response.status(403).send({error_msg: 'User Session Not Available'})
}

exports.tryAction = (handler) => (req, res) => {
    try {
        handler(req, res);
    } catch(error) {
        console.error(error.message || error);
        return error.name || error;
    }
}
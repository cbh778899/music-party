const { insert, update, getOne } = require("../database")

exports.upload = async function(userID, name, type, filename) {
    await insert('playlists', {
        user_id: userID, 
        name, type, filename, 
        upload_status: 'pending'
    });
    return true;
}

exports.getPlaylistInfo = async function(filename) {
    return await getOne('playlists', '*', {filename});
}

exports.finishUpload = async function(id) {
    await update('playlists', {
        upload_status: 'finished'
    }, {id});
    return true;
}
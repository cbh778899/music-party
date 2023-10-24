const { getPlaylistFile, getUserPlaylist, preUpload, uploadChunk, getUserUploadStatus, removePlayList, getMediaUploadStatus, setDirName } = require("../actions/playlist_actions");
const bodyParser = require('body-parser');
const { tryAction } = require("../utils");

module.exports = (app, express, dirName) => {
    setDirName(dirName)
    const router = express.Router();

    router.get('/:sessionID/:id/:requested_filename', tryAction(getPlaylistFile));
    router.get('/user-playlist', tryAction(getUserPlaylist));
    router.post('/pre-upload', tryAction(preUpload));
    router.post('/upload-chunk', bodyParser.raw({type: 'application/octet-stream', limit: '10mb'}), tryAction(uploadChunk));
    router.get('/user-upload-status', tryAction(getUserUploadStatus));
    router.get('/media-upload-status', tryAction(getMediaUploadStatus));
    router.delete('/', tryAction(removePlayList));

    app.use('/playlist', router)
}
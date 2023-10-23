require('dotenv').config();

// imports
const fs = require('fs')
const crypto = require('crypto')

// init
require('./database').openDB(null, true);

// express init
const express = require('express');
const bodyParser = require('body-parser');
const { login } = require('./actions/account_actions');
const { upload, uploadChunk, removePlayList, getUserPlaylist, getPlaylistInfo } = require('./actions/playlist_actions');
const app = express();
app.use(require('cors')())
app.use(bodyParser.json())

const router = express.Router()

router.get('/', (req, res)=>{
    res.sendFile(`${__dirname}/client.html`)
})

router.post('/login', async (req, res) => {
    const { account, password } = req.body;
    res.json(await login(account, password));
})

router.get('/playlists/:id', async (req, res) => {
    const id = + req.params.id;
    res.json(await getUserPlaylist(id))
})

router.get('/retrieve-playlist/:hashName/:filename', (req, res)=>{
    const { hashName, filename } = req.params;
    res.sendFile(`${__dirname}/all_files/${hashName}/${filename}`)
})

router.get('/ask-file/:filename', (req, res)=>{
    const filename = req.params.filename
    console.log(`requested ${filename}`)
    res.sendFile(`${__dirname}/test_playlist/${filename}`)
})

router.post('/pre-upload', async (req, res) => {
    const {userID, playListName, suffix, fileType} = req.body;
    const timeStamp = Date.now();
    const hash_name = crypto.createHash('md5').update(`${userID}${playListName}${timeStamp}`).digest('hex')
    fs.existsSync(hash_name) && fs.unlinkSync(hash_name);
    const playlistID = await upload(userID, playListName, fileType, hash_name, suffix);
    res.send(`${playlistID}`)
})

router.post('/upload-file', bodyParser.raw({type: 'application/octet-stream', limit: '10mb'}), async (req, res) => {
    const { playlistID, isLastChunk } = req.query;
    const data = req.body;
    
    await uploadChunk(playlistID, + isLastChunk, data);
    res.send(+ isLastChunk ? 'finished' : 'success')
})

router.delete('/playlist/:id', async (req, res) => {
    const id = + req.params.id;
    await removePlayList(id);
    res.send('ok');
})

app.use('/', router)

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', ()=>{
    console.log(
        `App listening on port ${PORT}\nGo to http://localhost:${PORT} for local view`
    );
})
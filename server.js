require('dotenv').config();

// imports
const fs = require('fs')
const crypto = require('crypto')

// types
const PROCESS_DIR = 'waiting_process',
      FILES_DIR = 'all_files';

// init
require('./database').openDB(null, true);
fs.existsSync(`./${FILES_DIR}`) || fs.mkdirSync(`./${FILES_DIR}`)
fs.existsSync(`./${PROCESS_DIR}`) || fs.mkdirSync(`./${PROCESS_DIR}`)

// express init
const express = require('express');
const bodyParser = require('body-parser');
const { login } = require('./actions/account_actions');
const { upload, finishUpload, getPlaylistInfo } = require('./actions/playlist_actions');
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

router.get('/playlists', (req, res) => {
    const playlists = fs.readdirSync(`./${FILES_DIR}`, {withFileTypes: true})
        .filter(f=>f.isDirectory())
        .map(e=>e.name)
    res.json(playlists)
})

router.get('/retrieve-playlist/:playlist/:filename', (req, res)=>{
    const { playlist, filename } = req.params;
    res.sendFile(`${__dirname}/all_files/${playlist}/${filename}`)
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
    const { playlistID, isLastTrunk } = req.query;
    const data = req.body;
    
    const { filename, suffix } = await getPlaylistInfo(+ playlistID);
    const process_file = `./${PROCESS_DIR}/${filename}.${suffix}`
    fs.appendFileSync(process_file, data)
    if(+ isLastTrunk) {
        await finishUpload(playlistID, process_file, FILES_DIR);
        res.send('finished');
    } else {
        res.send('success')
    }
})

app.use('/', router)

const PORT = process.env.PORT || 3000
app.listen(PORT, ()=>{
    console.log(
        `App listening on port ${PORT}\nGo to http://localhost:${PORT} for local view`
    );
})
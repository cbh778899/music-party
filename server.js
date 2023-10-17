require('dotenv').config();

const fs = require('fs')
const exec = require('child_process').exec
const TYPES = require('./types')

fs.existsSync(`./${TYPES.FILES_DIR}`) || fs.mkdirSync(`./${TYPES.FILES_DIR}`)
fs.existsSync(`./${TYPES.PROCESS_DIR}`) || fs.mkdirSync(`./${TYPES.PROCESS_DIR}`)

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(require('cors')())

const router = express.Router()

router.get('/', (req, res)=>{
    res.sendFile(`${__dirname}/client.html`)
})

router.get('/playlists', (req, res) => {
    const playlists = fs.readdirSync(`./${TYPES.FILES_DIR}`, {withFileTypes: true})
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

router.post('/upload-file', bodyParser.raw({type: 'application/octet-stream', limit: '10mb'}), (req, res) => {
    const { filename, isSpecialTrunk, fileType, renameFile } = req.query;
    const data = req.body;
    
    const process_file = `./${TYPES.PROCESS_DIR}/${filename}`
    isSpecialTrunk === TYPES.SPECIAL_TRUNK_START && fs.existsSync(process_file) && fs.unlinkSync(process_file);
    fs.appendFileSync(process_file, data)
    if(isSpecialTrunk === TYPES.SPECIAL_TRUNK_END) {
        let playlist_name = renameFile || filename.split('.').slice(0, -1).join('.')
        const playlist_dir = `./${TYPES.FILES_DIR}/${playlist_name}`
        fs.existsSync(playlist_dir) || fs.mkdirSync(playlist_dir)
        exec(`ffmpeg -i "${process_file}" ${fileType === 'video' ? '-map 0:v ' : ''}-map 0:a ${fileType === 'video' ? '-c:v libx264 ' : ''}-c:a aac -start_number 0 -hls_time 10 -hls_list_size 0 -f hls "${playlist_dir}/${playlist_name}.m3u8"`, (err, stdout, stderr) => {
            if(err) {
                console.error(`Error ${err}`)
            } else {
                // console.log(`stdout ${stdout}`)
                // console.log(`stderr ${stderr}`)
                fs.existsSync(process_file) && fs.unlinkSync(process_file);
                // TODO: insert new filename into db
            }
        })
    }

    res.send('success')
})

app.use('/', router)

const PORT = process.env.PORT || 3000
app.listen(PORT, ()=>{
    console.log(
        `App listening on port ${PORT}\nGo to http://localhost:${PORT} for local view`
    );
})
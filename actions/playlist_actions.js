const { insert, update, getOne, deleteFrom, getAll } = require("../database")
const { retrieveUser } = require("./account_actions");
const { send403, calculateStrHash } = require("../utils");
const fs = require('fs');
const exec = require('child_process').exec

const PROCESS_DIR = 'waiting_process',
      FILES_DIR = 'all_files';

let dirName;

fs.existsSync(`./${FILES_DIR}`) || fs.mkdirSync(`./${FILES_DIR}`)
fs.existsSync(`./${PROCESS_DIR}`) || fs.mkdirSync(`./${PROCESS_DIR}`)

async function finishUpload(filename, id, user_id, title, type, process_file) {

    await update('uploads', { upload_status: 'fragmenting' }, { id })

    const playlist_dir = `./${FILES_DIR}/${filename}`
    fs.existsSync(playlist_dir) || fs.mkdirSync(playlist_dir)

    // run fragmenting in child process
    exec(
        `ffmpeg -i "${process_file}" ${type === 'video' ? '-map 0:v ' : ''}`+
        `-map 0:a -c copy -start_number 0 `+
        `-hls_time 10 -hls_list_size 0 -f hls "${playlist_dir}/${filename}.m3u8"`, 
        async (err, stdout, stderr) => {
        
        if(err) {
            console.error(err.message);
            await update('uploads', { upload_status: 'failed' }, { id });
        } else {
            await update('uploads', { upload_status: 'finished' }, { id });
            const { lastID } = await insert('playlists', { user_id, title, type, filename });
            const playlist_id = await getOne('playlists', 'id', { rowid: lastID });
            await update('uploads', { playlist_id }, { id });
        }
        
        fs.existsSync(process_file) && fs.unlinkSync(process_file);
    })

    return true;
}

function uploadStatus(upload_info) {
    if(!upload_info) return {};
    const { id, title, playlist_id, upload_status, est_fragments, filename } = upload_info;
    const status = {
        id, title, playlist_id,
        status: upload_status,
        progress: 0
    }
    if(upload_status === 'fragmenting') {
        const playlist_dir = `${dirName}/${FILES_DIR}/${filename}`
        const currentFragments = fs.existsSync(playlist_dir) ? fs.readdirSync(playlist_dir).length - 1 : 0;
        status.progress = currentFragments / est_fragments;
    } else if(upload_status === 'finished') {
        status.progress = 1;
    }
    return status;
}

exports.setDirName = function(dir_name) {
    dirName = dir_name;
}

exports.getPlaylistFile = async function (req, res) {
    const { sessionID, id, requested_filename } = req.params;

    if((await retrieveUser(sessionID)) > 0) {
        const filename = await getOne('playlists', 'filename', {id: + id});
        if(!filename) res.status(400).json({error_msg: 'File Not Found!'})
        else res.sendFile(`${dirName}/${FILES_DIR}/${filename}/${requested_filename}`);
    } else send403(res);
}

exports.getUserPlaylist = async function(req, res) {
    const { sessionID } = req.query
    const user_id = await retrieveUser(sessionID);
    if(user_id > 0) {
        res.json( await getAll(
            'playlists', 
            ['id', 'title', 'type', 'filename'], 
            { user_id }
        ))
    } else send403(res);
}

exports.preUpload = async function (req, res) {
    const { sessionID, title, suffix, fileType, estFragments, estChunks } = req.body;
    const user_id = await retrieveUser(sessionID);
    if(user_id > 0) {
        const hash_name = calculateStrHash(`${user_id}${title}${Date.now()}`);
        const {lastID} = await insert('uploads', {
            user_id,
            title, suffix,
            type: fileType, 
            filename: hash_name,
            upload_status: 'pending',
            est_fragments: estFragments,
            est_chunks: estChunks,
        })
        const uploadReference = await getOne('uploads', 'id', {rowid: lastID});

        const process_file = `./${PROCESS_DIR}/${hash_name}.${suffix}`
        fs.existsSync(process_file) && fs.rmSync(process_file)

        res.send(`${uploadReference}`);
    } else send403(res)
}

exports.uploadChunk = async function(req, res) {
    const { sessionID, referenceID, chunkIndex } = req.query;
    const data = req.body;
    const user_id = await retrieveUser(sessionID);
    if(user_id > 0) {
        let result = false;
        const playlistInfo = await getOne('uploads', '*', { user_id, id: + referenceID })
        if(playlistInfo) {
            const { id, type, title, upload_status, filename, est_chunks, suffix } = playlistInfo;
            const process_file = `./${PROCESS_DIR}/${filename}.${suffix}`
            if(upload_status === 'pending') {
                result = true;
                fs.appendFileSync(process_file, data)
                if(+ chunkIndex === est_chunks - 1) {
                    await finishUpload(filename, id, user_id, title, type, process_file);
                }
            }
        }
        res.send(result)
    } else send403(res)
}

exports.getMediaUploadStatus = async function(req, res) {
    const { sessionID, referenceID } = req.query;
    const user_id = await retrieveUser(sessionID);
    if(user_id > 0) {
        const upload_info = await getOne('uploads', '*', { user_id, id: + referenceID })
        if(upload_info) {
            res.json(uploadStatus(upload_info))
        } else {
            res.status(400).send({error_msg: 'Media Not Exists'})
        }
    } else send403(res);
}

exports.getUserUploadStatus = async function(req, res) {
    const { sessionID } = req.query;
    const user_id = await retrieveUser(sessionID);
    if(user_id > 0) {
        res.json((await getAll('uploads', '*', { user_id })).map(uploadStatus))
    } else send403(res);
}

exports.updateTitle = async function(req, res) {
    const { sessionID, id, title } = req.body;
    const user_id = await retrieveUser(sessionID);
    if(user_id > 0) {
        let result = false;
        const waiting_update = await getOne('uploads', ['id', 'playlist_id'], { id, user_id })
        if(waiting_update) {
            result = true;
            const { playlist_id } = waiting_update;
            
            await update('uploads', { title }, { id });
            if(playlist_id) await update('playlists', { title }, { id: playlist_id });
        }
        res.send(result)
    } else send403(res)
}

exports.removePlayList = async function(req, res) {
    const { id, sessionID } = req.body;
    const user_id = await retrieveUser(sessionID);
    if(user_id > 0) {
        let result = false;
        const playlistInfo = await getOne('uploads', '*', {id, user_id});
        if(playlistInfo) {
            const { upload_status, filename, suffix, playlist_id } = playlistInfo;
            if(upload_status !== 'fragmenting') {
                result = true;
                const process_file = `./${PROCESS_DIR}/${filename}.${suffix}`;
                const playlist_dir = `./${FILES_DIR}/${filename}`;
                fs.existsSync(process_file) && fs.unlinkSync(process_file);
                fs.existsSync(playlist_dir) && fs.rmSync(playlist_dir, { recursive: true });
                await deleteFrom('uploads', { id });
                if(playlist_id) await deleteFrom('playlists', { id: playlist_id });
            }
        }
        res.send(result);
    } else send403(res);
}

exports.getPlaylistByIDs = async function(ids) {
    return await getAll(
        'playlists', 
        ['id', 'title', 'type', 'filename'], 
        {in: 'id', inArray: ids})
}
const { insert, update, getOne, deleteFrom } = require("../database")
const fs = require('fs');
const exec = require('child_process').exec

const PROCESS_DIR = 'waiting_process',
      FILES_DIR = 'all_files';

fs.existsSync(`./${FILES_DIR}`) || fs.mkdirSync(`./${FILES_DIR}`)
fs.existsSync(`./${PROCESS_DIR}`) || fs.mkdirSync(`./${PROCESS_DIR}`)


getPlaylistInfo = async function(id) {
    return await getOne('playlists', '*', {id});
}

finishUpload = async function(id, process_file) {
    const { filename, type } = await getPlaylistInfo(id);
    return new Promise(resolve => {
        const playlist_dir = `./${FILES_DIR}/${filename}`
        fs.existsSync(playlist_dir) || fs.mkdirSync(playlist_dir)
        exec(
            `ffmpeg -i "${process_file}" ${type === 'video' ? '-map 0:v ' : ''}`+
            `-map 0:a ${type === 'video' ? '-c:v libx264 ' : ''}-c:a aac -start_number 0 `+
            `-hls_time 10 -hls_list_size 0 -f hls "${playlist_dir}/${filename}.m3u8"`, 
            async (err, stdout, stderr) => {
            
            if(err) throw err;
            await update('playlists', { upload_status: 'finished' }, { id })
            fs.existsSync(process_file) && fs.rmSync(process_file);
            resolve();
        })
    })
}

exports.upload = async function(userID, name, type, filename, suffix) {
    const {lastID} = await insert('playlists', {
        user_id: userID, 
        name, type, filename, suffix,
        upload_status: 'pending'
    });
    return await getOne('playlists', 'id', {rowid: lastID});
}

exports.uploadChunk = async function(playlistID, isLastChunk, data) {
    try {
        const { filename, suffix, upload_status } = await getPlaylistInfo(+ playlistID);
        if(upload_status === 'finished') return false;
        const process_file = `./${PROCESS_DIR}/${filename}.${suffix}`
        fs.appendFileSync(process_file, data)
        if(+ isLastChunk) {
            await finishUpload(playlistID, process_file, FILES_DIR);
            return true;
        } else {
            return true;
        }
    } catch(err) {
        return false;
    }
}


exports.removePlayList = async function(id) {
    const {filename, suffix} = await getOne('playlists', ['filename', 'suffix'], {id});
    const process_file = `./${PROCESS_DIR}/${filename}.${suffix}`;
    const playlist_dir = `./${FILES_DIR}/${filename}`;
    fs.existsSync(process_file) && fs.rmSync(process_file)
    fs.existsSync(playlist_dir) && fs.rmSync(playlist_dir, { recursive: true })
    await deleteFrom('playlists', {id});
    return true;
}
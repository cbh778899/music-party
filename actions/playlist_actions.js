const { insert, update, getOne } = require("../database")
const fs = require('fs');
const exec = require('child_process').exec

exports.upload = async function(userID, name, type, filename, suffix) {
    const {lastID} = await insert('playlists', {
        user_id: userID, 
        name, type, filename, suffix,
        upload_status: 'pending'
    });
    return await getOne('playlists', 'id', {rowid: lastID});
}

exports.getPlaylistInfo = async function(id) {
    return await getOne('playlists', '*', {id});
}

exports.finishUpload = async function(id, process_file, files_dir) {
    const { filename, type } = await exports.getPlaylistInfo(id);
    return new Promise(resolve => {
        const playlist_dir = `./${files_dir}/${filename}`
        fs.existsSync(playlist_dir) || fs.mkdirSync(playlist_dir)
        exec(
            `ffmpeg -i "${process_file}" ${type === 'video' ? '-map 0:v ' : ''}`+
            `-map 0:a ${type === 'video' ? '-c:v libx264 ' : ''}-c:a aac -start_number 0 `+
            `-hls_time 10 -hls_list_size 0 -f hls "${playlist_dir}/${filename}.m3u8"`, 
            async (err, stdout, stderr) => {
            
            if(err) throw err;
            await update('playlists', { upload_status: 'finished' }, { id })
            fs.existsSync(process_file) && fs.unlinkSync(process_file);
            resolve();
        })
    })
}


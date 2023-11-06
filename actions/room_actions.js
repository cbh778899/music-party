const { getOne } = require("../database");
const { generateRoomCode } = require("../utils");
const { retrieveUser } = require("./account_actions");
const { getPlaylistByIDs } = require("./playlist_actions");

const openedRooms = {};

function endSession(ws, msgType) {
    ws.send(JSON.stringify({
        msgType,
        content: 
            msgType === 'ejection' ? "Connection ejected" :
            msgType === 'session-end' ? "Session has been terminated by user!" :
            msgType === 'room-not-exist' ? "The room not exist or expired." :
            ''
    }))

    ws.close();
}

function handleMsg(msg, ws, req) {
    const { roomID, userID, msgType, content } = msg;
    switch(msgType) {
        case 'create-room':
            createRoom(content, ws, req); return;
        case 'join-room':
            joinRoom(content, ws, req); return;
        case 'exit-room':
            exitRoom(roomID, userID, ws); return;
        case 'sync':
            syncProgress(roomID, userID, content, ws); break;
        case 'respond-sync':
            respondAutoSync(roomID, userID, content, ws); break;
        case 'switch-play-way':
            switchPlayWay(roomID, userID, content, ws); break;
        case 'update-playlist':
            updateRoomPlaylist(roomID, userID, content, ws); break;
        default: return;
    }

    if(roomID && userID && openedRooms[roomID] && openedRooms[roomID].sessions[userID]) {
        openedRooms[roomID].sessions[userID].lastActivate = Date.now();
    }
}

async function createRoom({sessionID, playlist, how}, ws, req) {
    const user_id = await retrieveUser(sessionID);
    if(user_id > 0) {
        let room_id;
        do {
            room_id = generateRoomCode();
        } while(openedRooms[room_id]);
        
        const userName = await getOne('accounts', 'account', { id: user_id });

        openedRooms[room_id] = {
            last_manual_update: 0,
            responded_sync: 0,
            joined_users: 1,
            master: user_id,
            playlist, how,
            sessions: {
                [user_id]: { 
                    ws, req, userName,
                    lastSyncProgress: {}, 
                    lastActivate: Date.now()
                }
            }
        }

        ws.send(JSON.stringify({
            msgType: 'room-created',
            content: { 
                roomID: room_id,
                userID: user_id,
                userName
            }
        }))
    } else endSession(ws, 'ejection');
}

async function joinRoom({sessionID, requestRoomID, playlist}, ws, req) {
    const user_id = await retrieveUser(sessionID);
    if(user_id <= 0) {
        endSession(ws, 'ejection');
        return;
    }
    if(!openedRooms[requestRoomID]) {
        endSession(ws, 'room-not-exist');
        return;
    }

    if(openedRooms[requestRoomID].sessions[user_id]) {
        exitRoom(requestRoomID, user_id);
    }
    const userName = await getOne('accounts', 'account', { id: user_id });
    openedRooms[requestRoomID].sessions[user_id] = { 
        ws, req, userName,
        lastSyncProgress: {}, 
        lastActivate: Date.now()
    }
    openedRooms[requestRoomID].joined_users ++;
    const new_added_playlist = playlist.filter(e=>! (e in openedRooms[requestRoomID].playlist))
    openedRooms[requestRoomID].playlist = openedRooms[requestRoomID].playlist.concat(new_added_playlist)

    const shared_content = {
        userName,
        playlistOrder: openedRooms[requestRoomID].playlist,
        playlistInfo: await getPlaylistByIDs(openedRooms[requestRoomID].playlist),
        howToPlay: openedRooms[requestRoomID].how
    }
    
    Object.entries(openedRooms[requestRoomID].sessions).forEach(session => {
        const [userID, { ws }] = session;
        if(+userID === user_id) {
            ws.send(JSON.stringify({
                msgType: 'joined-room',
                content: {
                    ...shared_content,
                    roomID: requestRoomID,
                    userID: user_id,
                }
            }))
        } else {
            ws.send(JSON.stringify({
                msgType: 'joined-room',
                content: shared_content
            }))
        }
    })

    initiateRoomSync(requestRoomID);
}

function exitRoom(roomID, userID, ws = null, msg = 'session-end') {
    if(!openedRooms[roomID] || !openedRooms[roomID].sessions[userID]) {
        endSession(ws, 'room-not-exist');
        return;
    } else {
        endSession(openedRooms[roomID].sessions[userID].ws, msg)
        delete openedRooms[roomID].sessions[userID];
        openedRooms[roomID].joined_users --;
        if(openedRooms[roomID].joined_users === 0) {
            delete openedRooms[roomID]
        }
    }
}

function switchPlayWay(roomID, userID, { howToPlay, playlistID }, ws) {
    if(!openedRooms[roomID] || !openedRooms[roomID].sessions[userID]) {
        endSession(ws, 'room-not-exist');
        return;
    }

    const new_order = howToPlay === 'random' ?
        [...openedRooms[roomID].playlist].sort(()=> .5 - Math.random()) :
        openedRooms[roomID].playlist

    openedRooms[roomID].how = howToPlay;
    const prepared_msg = JSON.stringify({
        msgType: 'update-play-way',
        content: {
            howToPlay,
            playlistOrder: new_order,
            playlistIdx: new_order.indexOf(playlistID)
        }
    })

    Object.values(openedRooms[roomID].sessions).forEach(session => {
        session.ws.send(prepared_msg)
    })
}

async function updateRoomPlaylist(roomID, userID, { playlist, playlistIdx }, ws) {
    if(!openedRooms[roomID] || !openedRooms[roomID].sessions[userID]) {
        endSession(ws, 'room-not-exist');
        return;
    }

    if(openedRooms[roomID].how !== 'random') {
        openedRooms[roomID].playlist = playlist;
    } else {
        // we don't know the order so just filter and get those different out
        // remove any is not in new playlist
        openedRooms[roomID].playlist = openedRooms[roomID].playlist.filter(e=>e in playlist)
        // add any is not in current playlist
        playlist.filter(e=>!(e in openedRooms[roomID].playlist)).forEach(e=>openedRooms[roomID].playlist.push(e));
    }
    const pass_order = openedRooms[roomID].how === 'random' ?
        [...openedRooms[roomID].playlist].sort(()=> .5 - Math.random()) :
        openedRooms[roomID].playlist

    const prepared_msg = JSON.stringify({
        msgType: 'update-playlist',
        content: {
            howToPlay: openedRooms[roomID].how,
            playlistInfo: await getPlaylistByIDs(openedRooms[roomID].playlist),
            playlistOrder: pass_order,
            playlistIdx: openedRooms[roomID].how === 'random' ?
                pass_order.indexOf(openedRooms[roomID].playlist[playlistIdx]) :
                playlistIdx
        }
    })

    Object.values(openedRooms[roomID].sessions).forEach(({ws}) => {
        ws.send(prepared_msg)
    })
}

function sendProgressSyncRequest({ playlistIdx, progress, isPaused }, ws) {
    ws.send(JSON.stringify({
        msgType: 'sync-progress',
        content: { playlistIdx, progress, isPaused }
    }))
}

function syncProgress(roomID, userID, progress, ws) {
    if(!openedRooms[roomID] || !openedRooms[roomID].sessions[userID]) {
        endSession(ws, 'room-not-exist');
        return;
    }
    if(openedRooms[roomID].last_manual_update > Date.now() - 100) {
        ws.send(JSON.stringify({ msgType: 'update-too-frequent' }));
        return;
    }

    Object.entries(openedRooms[roomID].sessions).forEach(session => {
        const [ user_id, { ws } ] = session;
        if(+user_id !== userID) sendProgressSyncRequest(progress, ws);
    })
    openedRooms[roomID].last_manual_update = Date.now();
}

// function delayedProgress({progress, date, isPaused}) {
//     let delay = 0;
//     if(!isPaused) {
//         delay = + (Math.abs(Date.now() - date) / 1000).toPrecision(5);
//     }
//     return progress + delay;
// }

function checkAutoSync(roomID) {
    const room = openedRooms[roomID]
    room.sessions[room.master] || newMaster(roomID)
    const master_progress = room.sessions[room.master].lastSyncProgress
    Object.entries(room.sessions).forEach(session => {
        const [userID, { ws, lastSyncProgress }] = session;
        if(+userID === openedRooms[roomID].master) return;
        
        // if(Math.abs(delayedProgress(master_progress) - delayedProgress(lastSyncProgress)) > 1) {
        //     sendProgressSyncRequest(master_progress, ws);
        // }
        if(lastSyncProgress.neverSynced) sendProgressSyncRequest(master_progress, ws);
    })
}

function respondAutoSync(roomID, userID, content, ws) {
    if(!openedRooms[roomID] || !openedRooms[roomID].sessions[userID]) {
        endSession(ws, 'room-not-exist');
        return;
    }

    openedRooms[roomID].responded_sync ++;
    openedRooms[roomID].sessions[userID].lastSyncProgress = content;

    if(openedRooms[roomID].responded_sync === openedRooms[roomID].joined_users) {
        checkAutoSync(roomID);
    }
}

function initiateRoomSync(roomID, sessions = null) {
    if(!sessions) sessions = openedRooms[roomID].sessions;
    sessions[openedRooms[roomID].master] || newMaster(roomID)
    const username_list = Object.values(sessions).map(e=>e.userName);
    const master_username = sessions[openedRooms[roomID].master].userName
    Object.entries(sessions).forEach(session => {
        const [ userID, { lastActivate, ws } ] = session;

        if(lastActivate < Date.now() - 10000) {
            exitRoom(roomID, userID, null, 'ejection');
        } else {
            ws.send(JSON.stringify({
                msgType: 'sync-info',
                content: {
                    users: username_list,
                    master: master_username
                }
            }));
            openedRooms[roomID].responded_sync = 0;
        }
    })
}

function newMaster(roomID) {
    openedRooms[roomID].master = Object.keys(openedRooms[roomID].sessions)[0]
}

setInterval(() => {
    Object.entries(openedRooms).forEach(room => {
        const [ roomID, {sessions} ] = room;
        initiateRoomSync(roomID, sessions);
    })
}, 5000);

exports.room = function(ws, req) {
    ws.on('message', msg=>handleMsg(JSON.parse(msg), ws, req));
    ws.on('error', err => { throw err; })
}
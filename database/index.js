const { OPEN_READONLY, OPEN_READWRITE, OPEN_CREATE } = require('sqlite3');
const { open, close, get, all, run } = require('./promise_sqlite3')

function formateObjWhere(queryObj, action = null) {
    if(queryObj.in) {
        return `${queryObj.in} IN (${queryObj.inArray.map((e, i)=>{
            action && action(e, i);
            return '?'
        }).join(', ')})`
    } else {
        return Object.entries(queryObj).map(e=>{
            const [key, value] = e;
            action && action(value, key);
            return `${key}=?`;
        }).join(' AND ')
    }
}

function formatWhereQuery(whereQuery, action = null) {
    let query = ' WHERE '
    if(Array.isArray(whereQuery)) {
        query += whereQuery.map(objWhere => {
            return `(${formateObjWhere(objWhere, action)})`
        }).join` OR `;
    } else {
        query += formateObjWhere(whereQuery, action);
    }

    return query;
}

function formatSelectQuery(table, select = '*', whereQuery = null) {
    let query = 'SELECT ';
    const params = [];

    query += (typeof select === 'object') ? select.join(', ') : select;
    query += ' FROM ' + table;
    if(whereQuery) query += formatWhereQuery(whereQuery, v=>params.push(v));

    return { query, params }
}

async function initDB(db) {
    await run(db, `CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY NOT NULL,
        account TEXT, password TEXT
    )`);

    await run(db, `CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY NOT NULL, user_id INTEGER,
        title TEXT, type TEXT, filename TEXT
    )`);

    await run(db, `CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY NOT NULL, 
        user_id INTEGER, playlist_id INTEGER,
        title TEXT, type TEXT,
        filename TEXT, suffix TEXT, upload_status TEXT,
        est_fragments INTEGER, est_chunks INTEGER
    )`);

    await run(db, `CREATE TABLE IF NOT EXISTS login_records (
        id INTEGER PRIMARY KEY NOT NULL, 
        user_id INTEGER, session_id TEXT, exp_date TEXT
    )`);

    await close(db);
    return;
}

exports.openDB = async function (mode = null, init = false) {
    const open_mode = init ? 
        OPEN_READWRITE | OPEN_CREATE :
        mode === null ? OPEN_READWRITE : mode;

    const db = await open('./yinpa.db', open_mode);
    if(init) return await initDB(db);
    return db;
}

exports.getAll = async function (table, select = '*', where = null) {
    const { query, params } = formatSelectQuery(table, select, where);
    const db = await exports.openDB(OPEN_READONLY);
    const allResult = await all(db, query, params);
    await close(db);
    return allResult;
}

exports.getOne = async function (table, select = '*', where = null) {
    const { query, params } = formatSelectQuery(table, select, where);
    const db = await exports.openDB(OPEN_READONLY);
    const getResult = await get(db, query, params);
    await close(db);
    if(typeof select === 'string' && select !== '*') {
        return getResult ? getResult[select] : null;
    } return getResult;
}

exports.insert = async function (table, insertQuery) {
    const keys = [], values = [];
    for(const key in insertQuery) {
        keys.push(key);
        values.push(insertQuery[key]);
    }
    let query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${values.map(()=>'?').join(', ')})`;

    const db = await exports.openDB();
    const res = await run(db, query, values);
    await close(db);
    return res;
}

exports.update = async function (table, updateQuery, whereQuery) {
    const values = [];
    let query = `UPDATE ${table} SET ${
        Object.entries(updateQuery).map(e=>{
            const [key, value] = e;
            values.push(value);
            return `${key}=?`
        }).join(', ')
    }${whereQuery ? formatWhereQuery(whereQuery, v=>values.push(v)) : ''}`;

    const db = await exports.openDB();
    const res = await run(db, query, values);
    await close(db);
    return res;
}

exports.deleteFrom = async function (table, whereQuery) {
    const db = await exports.openDB();
    const params = [];
    const res = await run(db, 
        `DELETE FROM ${table}${
            whereQuery ? formatWhereQuery(whereQuery, v=>params.push(v)) : ''
        }`, params);
    await close(db);
    return res;
}
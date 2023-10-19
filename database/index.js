const { OPEN_READONLY, OPEN_READWRITE, OPEN_CREATE } = require('sqlite3');
const { open, close, get, all, run } = require('./promise_sqlite3')

function formatWhereQuery(whereQuery, action = null) {
    return (
        ` WHERE ${Object.entries(whereQuery).map(e=>{
            const [key, value] = e;
            action && action(value, key);
            return `${key}=?`;
        }).join(' AND ')}`
    )
}

function formatSelectQuery(table, select = '*', whereQuery = null) {
    let query = 'SELECT ';
    const params = [];

    query += (typeof select === 'object') ? select.join(', ') : select;
    query += ' FROM ' + table;
    if(whereQuery) query += formatWhereQuery(whereQuery, v=>params.push(v));

    return { query, params }
}

exports.openDB = async function (mode = null, init = false) {
    const open_mode = init ? 
        OPEN_READWRITE | OPEN_CREATE :
        mode === null ? OPEN_READWRITE : mode;

    const db = await open('./yinpa.db', open_mode);
    if(init) {
        await run(db, `CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY NOT NULL,
            account TEXT, password TEXT
        )`);

        await run(db, `CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY NOT NULL,
            name TEXT, type TEXT
        )`);

        await close(db);
        return;
    }
    return db;
}

exports.getAll = async function (table, select = '*', where = null) {
    const { query, params } = formatSelectQuery(table, select, where);
    return await all(await exports.openDB(OPEN_READONLY), query, params);
}

exports.getOne = async function (table, select = '*', where = null) {
    const { query, params } = formatSelectQuery(table, select, where);
    return await get(await exports.openDB(OPEN_READONLY), query, params);
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
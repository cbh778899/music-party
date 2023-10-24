const { getOne, insert, deleteFrom } = require("../database");
const { calculateStrHash, calculateExpDate } = require("../utils");
const table = 'accounts';

exports.retrieveUser = async function (session_id) {
    const result = await getOne(
        'login_records', ['id', 'user_id', 'exp_date'], { session_id }
    )
    if(result) {
        const { id, user_id, exp_date } = result;
        if(Date.now() > +exp_date) {
            await deleteFrom('login_records', { id });
        } else {
            return user_id;
        }
    }
    return -1
}

exports.login = async function(req, res) {

    const { account, password } = req.body;

    const ret = {
        result: 'login-failed',
        sessionID: ''
    }
    let userID = -1

    if(account && password) {
        const user = await getOne(table, ['id','password'], {account});
        if(!user) {
            const {lastID} = await insert(table, {account, password});
            userID = (await getOne(table, 'id', {rowid: lastID}))
            ret.result = 'account-created';
        } else if(user.password === password) {
            userID = user.id;
            ret.result = 'login-success';
        }
    }

    if(ret.result !== 'login-failed') {
        const requestDate = Date.now();
        const sessionID = calculateStrHash(`${userID}${requestDate}`);
        await insert('login_records', {
            user_id: userID, 
            session_id: sessionID,
            exp_date: calculateExpDate(requestDate)
        });
        ret.sessionID = sessionID;
    }
    
    res.json(ret)
}

exports.validateLogin = async function(req, res) {
    const { sessionID } = req.body
    res.send((await exports.retrieveUser(sessionID)) > 0);
}
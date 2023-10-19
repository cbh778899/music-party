const { getOne, insert } = require("../database")
const table = 'accounts';

exports.login = async function(account, password) {
    if(!account || !password) return {result: 'login-failed'}
    const user = await getOne(table, ['id','password'], {account});
    let res  = {}
    if(!user) {
        const {lastID} = await insert(table, {account, password});
        res.userID = (await getOne(table, 'id', {rowid: lastID}))
        res.result = 'account-created';
    } else {
        if(user.password !== password) {
            res.result = 'login-failed';
        } else {
            res = {
                result: 'login-success',
                userID: user.id
            }
        }
    }
    return res;
}
const { login, validateLogin } = require("../actions/account_actions");
const { tryAction } = require("../utils");

module.exports = (app, express) => {
    const router = express.Router();

    router.post('/login', tryAction(login));
    router.post('/validate-login', tryAction(validateLogin));

    app.use('/account', router)
}
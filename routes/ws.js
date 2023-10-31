const { room } = require("../actions/room_actions");
const { tryAction } = require("../utils");

module.exports = (app, express) => {
    const router = express.Router();

    router.ws('/room', tryAction(room))

    app.use('/ws', router)
}
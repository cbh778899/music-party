require('dotenv').config();

// imports
const fs = require('fs')
const crypto = require('crypto')

// init
require('./database').openDB(null, true);

// express init
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
require('express-ws')(app);
app.use(require('cors')())
app.use(bodyParser.json())

require('./routes')(app, express, __dirname);

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', ()=>{
    console.log(
        `App listening on port ${PORT}\nGo to http://localhost:${PORT} for local view`
    );
})
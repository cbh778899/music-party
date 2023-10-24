module.exports = (app, express, dirName) => {
    require('./global')(app, express, dirName)
    require('./account')(app, express)
    require('./playlist')(app, express, dirName)
}
module.exports = (app, express, dirName) => {
    const router = express.Router();

    router.get('/', (req, res)=>{
        res.sendFile(`${dirName}/client.html`)
    })

    app.use('/', router)
}
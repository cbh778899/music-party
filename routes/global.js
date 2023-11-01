module.exports = (app, express, dirName) => {
    const router = express.Router();

    router.get('/', (req, res)=>{
        res.sendFile(`${dirName}/client.html`)
    })

    router.get('/src/:filename', (req, res) => {
        const {filename} = req.params;
        res.sendFile(`${dirName}/src/${filename}`)
    })

    app.use('/', router)
}
import express from 'express';
const app = express();
import waRouter from "./src/routes/whatsappRoutes.js"

// root route
app.get('/', (req, res) => {
    res.status(200)
    .send({
        'message' : 'server is runing'
    });
});
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use('/wa', waRouter);

app.get('*', (req, res) => {
    res.status(404)
    .send({
        'message' : 'not found'
    });
});

app.listen(3000, () => {
    console.log('server is runing on http://localhost:3000');
});
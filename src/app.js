import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import usersRoute from './routes/usersRoute.js';
import authRoute from './routes/authRoute.js';

const app = express();

dotenv.config();

app.use(express.json());
const __dirname = path.dirname(fileURLToPath(import.meta.url)),
rootDir= path.resolve(__dirname, '..');


app.use(express.static(path.join(rootDir, 'public')));

app.use('/api/users', usersRoute);
app.use('/auth', authRoute);


console.log(path.join(rootDir, 'public', 'index.html'))
app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'index.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'about.html'));
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

export default app;

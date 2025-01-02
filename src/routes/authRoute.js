import express from 'express';
import jwt from 'jsonwebtoken';
// import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const users = [];

router.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    
    // const hashedPassword = await bcrypt.hash(password, 10);

    const user = { username, password: password };
    users.push(user);

    res.status(201).json({ status:true, message: 'User registered successfully' });
});


router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(400).json({ status:false, message: 'Invalid credentials' });
    }

    // const isMatch = await bcrypt.compare(password, user.password);
    const isMatch = password === user.password;
    if (!isMatch) {
        return res.status(400).json({ status:false, message: 'Invalid credentials' });
    }

    
    const token = jwt.sign( {username: user.username,id:2 }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

    res.json({ status:true, message:'Sign in successfully', token });
});

export default router;
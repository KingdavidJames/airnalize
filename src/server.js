import express from 'express';
import app  from './app.js';
import connectDB from './db.js';
import dotenv from 'dotenv';
dotenv.config();
const port = process.env.PORT || 5000;

connectDB();

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

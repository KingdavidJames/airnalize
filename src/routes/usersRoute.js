import express from 'express';
const router = express.Router();
import { getUsers, createUser, getUserById, getUser } from '../controllers/usersController.js';
import { authenticateToken } from '../middleware/authMiddleware.js'; 

console.log('usersRoute.js');
router.get('/', authenticateToken, getUsers); 
// router.get('/:id', authenticateToken, getUserById); 
router.get('/:username', getUser); 
// router.post('/', authenticateToken, createUser); 
router.post('/', createUser); 

export default router;

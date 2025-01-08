import express from 'express';
import { submitRequest } from '../controllers/requestController';

const router = express.Router();

router.post('/submit', submitRequest);

export default router;

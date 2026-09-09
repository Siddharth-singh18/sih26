import { Router } from 'express';
import { handleFindNearbyCare } from './routing.controller';

const router = Router();

router.post('/nearby', handleFindNearbyCare);

export default router;


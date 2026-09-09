import { Router } from 'express';
import { handleAssistantChat, handleGetFormularyCatalog } from './health_assistant.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Allow authenticated users (or anonymous health queries)
router.post('/chat', handleAssistantChat);
router.get('/formulary', handleGetFormularyCatalog);

export default router;

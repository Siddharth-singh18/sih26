import { Router } from 'express';
import { handleTranscribe, handleSpeak, handleGetCapabilities } from './voice.controller';

const router = Router();

router.post('/transcribe', handleTranscribe);
router.post('/speak', handleSpeak);
router.get('/capabilities', handleGetCapabilities);

export default router;


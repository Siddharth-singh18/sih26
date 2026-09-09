import { Router } from 'express';
import { handleTranslate, handleGetLanguages, handleGetLanguageCapabilities } from './i18n.controller';

const router = Router();

router.post('/translate', handleTranslate);
router.get('/languages', handleGetLanguages);
router.get('/capabilities', handleGetLanguageCapabilities);

export default router;


import { Router } from 'express';
import { getInventoryStatus, listMedicines, registerFormularyMedicine } from './inventory.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

// Public inventory status (transparent capability disclosure)
router.get('/status', getInventoryStatus);
router.get('/availability', getInventoryStatus);

// List formulary catalog
router.get('/medicines', listMedicines);

// Register medicine to formulary (Doctor/Admin only)
router.post('/medicines', requireRole('DOCTOR'), registerFormularyMedicine);

export default router;

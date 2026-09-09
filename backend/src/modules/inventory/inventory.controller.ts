import { Request, Response } from 'express';
import { prisma } from '../../index';

/**
 * MEDICINE INVENTORY & FORMULARY STATUS CONTROLLER
 * Strictly complies with Zero-Mock policy:
 * Reports NOT_SUPPORTED_BY_SCHEMA for dynamic multi-facility stock tracking,
 * preventing fake inventory quantities or synthetic stockout alerts.
 */

export const getInventoryStatus = async (req: Request, res: Response) => {
  try {
    const medicines = await prisma.medication.findMany({
      orderBy: { name: 'asc' }
    });

    const items = medicines.map(m => ({
      id: m.id,
      name: m.name,
      type: m.type,
      dosage: (m as any).dosage || 'Standard clinical formulary unit',
      stockTracking: 'NOT_SUPPORTED_BY_SCHEMA',
      simulatedStock: null
    }));

    res.json({
      status: 'NOT_SUPPORTED_BY_SCHEMA',
      capability: 'FACILITY_MEDICINE_INVENTORY',
      message: 'Dynamic multi-facility medicine inventory ledger is not supported by current PostgreSQL schema. Synthetic stock quantities strictly prohibited by AyuSync policy.',
      explanation: 'Dynamic multi-facility medicine inventory ledger is not supported by current Prisma schema (Medication model contains formulary metadata only). Synthetic stock quantities strictly prohibited by AyuSync Zero-Mock policy.',
      supportedCapabilities: {
        formularyCatalog: true,
        clinicalPrescriptionOrdering: true,
        dispensingLedger: false,
        batchExpiryTracking: false,
        realtimeStockDeduction: false
      },
      formularyItemCount: medicines.length,
      formularyCatalog: items,
      formularyItems: items
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const listMedicines = async (req: Request, res: Response) => {
  try {
    const medicines = await prisma.medication.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(medicines);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const registerFormularyMedicine = async (req: Request, res: Response) => {
  try {
    const { name, type } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Bad Request', message: 'Medicine name is required' });
    }

    const med = await prisma.medication.upsert({
      where: { name },
      update: { type: type || 'TABLET' },
      create: { name, type: type || 'TABLET', stock: 0 }
    });

    res.status(201).json(med);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

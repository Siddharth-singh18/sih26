import { Request, Response } from 'express';
import { runHealthcareAssistant } from './health_assistant.service';
import { prisma } from '../../index';

export async function handleAssistantChat(req: Request, res: Response) {
  try {
    const { query, patientId, facilityId, languageCode, simpleMode, userLocation } = req.body;
    const user = (req as any).user;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is mandatory.' });
    }

    const response = await runHealthcareAssistant({
      query,
      userId: user?.id,
      role: user?.roles?.[0] || 'PATIENT',
      patientId: patientId || user?.patientId,
      facilityId,
      languageCode,
      simpleMode: Boolean(simpleMode),
      userLocation
    });

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('[Health Assistant] Chat error:', error);
    return res.status(500).json({ error: error.message || 'Internal health assistant failure' });
  }
}

export async function handleGetFormularyCatalog(req: Request, res: Response) {
  try {
    const facilityId = (req.query.facilityId as string) || (req.query.facility as string);

    // Schema capability honest disclosure
    const medications = await prisma.medication.findMany();

    return res.status(200).json({
      status: 'NOT_SUPPORTED_BY_SCHEMA',
      explanation: 'Dynamic multi-facility live medication stock ledgers are not supported by the current database schema.',
      catalogSource: 'PostgreSQL Medication table',
      facilityId: facilityId || null,
      totalRegistered: medications.length,
      formulary: medications.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
        registeredStock: m.stock
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch medication catalog' });
  }
}


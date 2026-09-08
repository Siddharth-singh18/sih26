import { Response } from 'express';
import { prisma } from '../../index';
import { AuthRequest } from '../../middleware/auth';

export const listDiagnostics = async (req: AuthRequest, res: Response) => {
  try {
    const { status, testName } = req.query;
    const where: any = {};
    if (status) where.status = String(status);
    if (testName) where.testName = { contains: String(testName), mode: 'insensitive' };

    const orders = await prisma.diagnosticOrder.findMany({
      where,
      include: {
        results: true
      },
      orderBy: { id: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getDiagnosticById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.diagnosticOrder.findUnique({
      where: { id },
      include: {
        results: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Not Found', message: 'Diagnostic order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createDiagnosticOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { testName, status, results } = req.body;
    if (!testName) {
      return res.status(400).json({ error: 'Bad Request', message: 'testName is required' });
    }

    const orderData: any = {
      testName,
      status: status || 'PENDING'
    };

    if (Array.isArray(results) && results.length > 0) {
      orderData.results = {
        create: results.map((r: any) => ({
          resultValue: String(r.resultValue || r.value || ''),
          isAbnormal: Boolean(r.isAbnormal)
        }))
      };
    }

    const order = await prisma.diagnosticOrder.create({
      data: orderData,
      include: { results: true }
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


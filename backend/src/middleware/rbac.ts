import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const requirePermission = (requiredPermission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    if (!req.user.permissions.includes(requiredPermission) && !req.user.roles.includes('ADMIN')) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Missing required permission: ${requiredPermission}` 
      });
    }

    next();
  };
};

export const requireRole = (requiredRole: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    if (!req.user.roles.includes(requiredRole) && !req.user.roles.includes('ADMIN')) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Missing required role: ${requiredRole}` 
      });
    }

    next();
  };
};

const express = require('express');
import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from '../services/MonitoringService';

const monitoringService = new MonitoringService();

export const validateRequest = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress;

  // Check if IP is undefined or invalid
  if (!ip) {
    return res.status(400).json({ error: 'Could not determine client IP address' });
  }

  // Additional IP validation (optional)
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip) && ip !== '::1' && !ip.startsWith('::ffff:')) {
    return res.status(400).json({ error: 'Invalid IP address format' });
  }

  if (!req.headers['authorization']) {
    await monitoringService.logFailedRequest(
      ip,
      'Missing authorization header',
      req.headers,
      req.path
    );
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = req.headers['authorization'].replace('Bearer ', '');
  if (!isValidToken(token)) {
    await monitoringService.logFailedRequest(
      ip,
      'Invalid access token',
      req.headers,
      req.path
    );
    return res.status(401).json({ error: 'Invalid access token' });
  }

  next();
};

function isValidToken(token: string): boolean {
  return token === process.env.VALID_TOKEN;
}

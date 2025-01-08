import { Request, Response } from 'express';
import RequestLog from '../models/FailedRequest';
import { checkRateLimit } from '../utils/rateLimiter';
import { sendAlertEmail } from '../services/MonitoringService';

export const submitRequest = async (req: Request, res: Response) => {
  const ip = req.ip;
  const { headers, body } = req;

  // Check if request is invalid (you can add specific header checks here)
  if (!headers['access-token'] || body.someInvalidField) {
    // Log the failed request
    const log = new RequestLog({
      ip,
      reason: 'Invalid access token or request body',
    });
    await log.save();

    // Check if rate limit is exceeded
    const breach = await checkRateLimit(ip);

    if (breach) {
      const failedAttempts = await RequestLog.countDocuments({ ip });
      await sendAlertEmail(ip, failedAttempts);
    }

    return res.status(400).json({ message: 'Invalid request' });
  }

  return res.status(200).json({ message: 'Request successful' });
};


export const getMetrics = async (req: Request, res: Response) => {
  const metrics = await RequestLog.aggregate([
    { $group: { _id: "$ip", failedAttempts: { $sum: 1 } } },
  ]);
  res.json(metrics);
};


// src/services/MonitoringService.ts
import nodemailer from 'nodemailer';
import { config } from '../config';
import { FailedRequest } from '../models/FailedRequest';
import * as cache from 'memory-cache';

export class MonitoringService {
  private cache: typeof cache;
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    this.cache = cache;
    this.emailTransporter = nodemailer.createTransport(config.smtp);
  }

  async logFailedRequest(ip: string, reason: string, headers: any, endpoint: string) {
    await FailedRequest.create({
      ip,
      reason,
      headers,
      endpoint,
    });

    const key = `failed_${ip}`;
    const currentCount = (this.cache.get(key) || 0) + 1;
    this.cache.put(key, currentCount, config.monitoring.timeWindowMinutes * 60 * 1000);

    if (currentCount >= config.monitoring.maxFailedAttempts) {
      await this.sendAlert(ip, currentCount, reason);
      this.cache.del(key);
    }
  }

  private async sendAlert(ip: string, attempts: number, reason: string) {
    const mailOptions = {
      from: config.smtp.auth.user,
      to: config.alertRecipients.join(','),
      subject: `Alert: Multiple Failed Requests from IP ${ip}`,
      text: `
        Warning: Multiple failed requests detected
        IP Address: ${ip}
        Failed Attempts: ${attempts}
        Time Window: ${config.monitoring.timeWindowMinutes} minutes
        Last Failure Reason: ${reason}
        
        Please investigate this activity immediately.
      `,
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  async getMetrics(startTime?: Date, endTime?: Date) {
    const query: any = {};
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = startTime;
      if (endTime) query.timestamp.$lte = endTime;
    }

    return await FailedRequest.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            ip: '$ip',
            reason: '$reason',
          },
          count: { $sum: 1 },
          firstSeen: { $min: '$timestamp' },
          lastSeen: { $max: '$timestamp' },
        },
      },
    ]);
  }
}

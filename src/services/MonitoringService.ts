import nodemailer from 'nodemailer';
import Redis from 'ioredis';
import { config } from '../config';
import { FailedRequest } from '../models/FailedRequest';

interface FailedRequestData {
  ip: string;
  reason: string;
  headers: any;
  endpoint: string;
}

interface MetricsQuery {
  timestamp?: {
    $gte?: Date;
    $lte?: Date;
  };
}

export class MonitoringService {
  private emailTransporter: nodemailer.Transporter;
  private redis: Redis;
  private CACHE_TTL = 300; // 5 minutes cache TTL
  private METRICS_CACHE_KEY = 'metrics_cache:';

  constructor() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      this.redis.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      this.emailTransporter = nodemailer.createTransport(config.smtp);
    } catch (error) {
      console.error('Failed to initialize MonitoringService:', error);
      throw error;
    }
  }

  private generateMetricsCacheKey(startTime?: Date, endTime?: Date): string {
    return `${this.METRICS_CACHE_KEY}${startTime?.toISOString() || 'none'}_${endTime?.toISOString() || 'none'}`;
  }

  async logFailedRequest(ip: string, reason: string, headers: any, endpoint: string): Promise<void> {
    try {
      const requestData: FailedRequestData = {
        ip,
        reason,
        headers,
        endpoint,
      };

      await FailedRequest.create(requestData);

      // Invalidate metrics cache when new data is added
      const cacheKeys = await this.redis.keys(`${this.METRICS_CACHE_KEY}*`);
      if (cacheKeys.length > 0) {
        await this.redis.del(...cacheKeys);
      }

      const key = `failed_${ip}`;
      const count = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.expire(key, config.monitoring.timeWindowMinutes * 60);
      }

      if (count >= config.monitoring.maxFailedAttempts) {
        await this.sendAlert(ip, count, reason);
        await this.redis.del(key);
      }
    } catch (error: any) {
      console.error('Error logging failed request:', error);
      throw new Error(`Failed to log request: ${error.message}`);
    }
  }

  async getMetrics(startTime?: Date, endTime?: Date) {
    try {
      const cacheKey = this.generateMetricsCacheKey(startTime, endTime);

      // Try to get from cache first
      const cachedMetrics = await this.redis.get(cacheKey);
      if (cachedMetrics) {
        console.log('Cache hit for metrics');
        return JSON.parse(cachedMetrics);
      }

      console.log('Cache miss for metrics, fetching from database');
      const query: MetricsQuery = {};

      if (startTime || endTime) {
        query.timestamp = {};
        if (startTime) query.timestamp.$gte = startTime;
        if (endTime) query.timestamp.$lte = endTime;
      }

      const metrics = await FailedRequest.aggregate([
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
        { $sort: { count: -1 } }
      ]);

      // Store in cache
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(metrics));
      return metrics;

    } catch (error: any) {
      console.error('Error fetching metrics:', error);
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }
  }

  private async sendAlert(ip: string, attempts: number, reason: string): Promise<void> {
    try {
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
          Time: ${new Date().toISOString()}
        `,
      };

      await this.emailTransporter.sendMail(mailOptions);
    } catch (error: any) {
      console.error('Error sending alert:', error);
      throw new Error(`Failed to send alert: ${error.message}`);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.redis.quit();
      this.emailTransporter.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

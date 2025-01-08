// src/app.ts
import { Request, Response } from 'express';
const express = require('express');
const mongoose = require('mongoose');
import { config } from './config';
import { validateRequest } from './middlerware/requestValidator';
import { MonitoringService } from './services/MonitoringService';

const app = express();
const monitoringService = new MonitoringService();

mongoose.connect(config.mongodb.uri)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err: Error) => console.error('MongoDB connection error:', err));

app.use(express.json());

app.post('/api/submit', validateRequest, (req: Request, res: Response) => {
  res.json({ message: 'Success' });
});

app.get('/api/metrics', async (req: Request<any, any, any, MetricsQueryParams>, res: Response) => {
  try {
    const startTime = req.query.startTime ? new Date(req.query.startTime) : undefined;
    const endTime = req.query.endTime ? new Date(req.query.endTime) : undefined;

    const metrics = await monitoringService.getMetrics(startTime, endTime);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Add this interface for the metrics query parameters
interface MetricsQueryParams {
  startTime?: string;
  endTime?: string;
}

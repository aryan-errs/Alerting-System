const dotenv = require('dotenv');
dotenv.config();

export const config = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/request-monitor',
  },
  monitoring: {
    timeWindowMinutes: 10,
    maxFailedAttempts: 5,
  },
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  alertRecipients: process.env.ALERT_RECIPIENTS?.split(',') || [],
};

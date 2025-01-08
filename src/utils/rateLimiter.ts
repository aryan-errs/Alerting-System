import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
  points: 5, // Maximum number of failed requests per IP
  duration: 600, // 10 minutes (600 seconds)
});

export const checkRateLimit = async (ip: string) => {
  try {
    await rateLimiter.consume(ip); // Track the request
    return false; // No limit breached
  } catch (err) {
    return true; // Limit breached
  }
};

import rateLimit, { type RateLimitRequest } from "express-rate-limit";
import { Request, Response } from "express";

// Trusted IPs that should have higher limits or be exempt
const TRUSTED_IPS = process.env.TRUSTED_IPS?.split(",") || [];

// Suspicious IPs that should be blocked (can be populated dynamically)
const suspiciousIPs = new Set<string>();

// Helper to get client IP
function getClientIP(req: Request | RateLimitRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

// Helper to check if IP is trusted
function isTrustedIP(ip: string): boolean {
  return TRUSTED_IPS.includes(ip);
}

// Helper to check if IP is suspicious
function isSuspiciousIP(ip: string): boolean {
  return suspiciousIPs.has(ip);
}

// Add IP to suspicious list
export function markSuspiciousIP(ip: string) {
  suspiciousIPs.add(ip);
  // Auto-remove after 1 hour
  setTimeout(() => {
    suspiciousIPs.delete(ip);
  }, 60 * 60 * 1000);
}

// Login rate limiter: 5 attempts per 15 minutes
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req: Request) => {
    const ip = getClientIP(req as RateLimitRequest);
    return isTrustedIP(ip);
  },
  keyGenerator: (req: Request) => {
    // Use email if available, otherwise IP
    const email = (req.body as any)?.email;
    return email ? `login:${email}` : `login:${getClientIP(req as RateLimitRequest)}`;
  },
  handler: (req: Request, res: Response) => {
    const ip = getClientIP(req as RateLimitRequest);
    markSuspiciousIP(ip);
    const rateLimitInfo = (req as RateLimitRequest).rateLimit;
    res.status(429).json({
      error: "Too many login attempts. Please try again after 15 minutes.",
      retryAfter: Math.ceil((rateLimitInfo?.resetTime ? (typeof rateLimitInfo.resetTime === 'number' ? rateLimitInfo.resetTime : rateLimitInfo.resetTime.getTime()) - Date.now() : 15 * 60 * 1000) / 1000),
    });
  },
});

// General API rate limiter: 100 requests per minute
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    const ip = getClientIP(req as RateLimitRequest);
    return isTrustedIP(ip) || isSuspiciousIP(ip); // Block suspicious IPs
  },
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    const userId = (req as any).user?.id;
    return userId ? `api:${userId}` : `api:${getClientIP(req as RateLimitRequest)}`;
  },
  handler: (req: Request, res: Response) => {
    const ip = getClientIP(req as RateLimitRequest);
    if (!isTrustedIP(ip)) {
      markSuspiciousIP(ip);
    }
    const rateLimitInfo = (req as RateLimitRequest).rateLimit;
    res.status(429).json({
      error: "Too many requests. Please slow down.",
      retryAfter: Math.ceil((rateLimitInfo?.resetTime ? (typeof rateLimitInfo.resetTime === 'number' ? rateLimitInfo.resetTime : rateLimitInfo.resetTime.getTime()) - Date.now() : 60 * 1000) / 1000),
    });
  },
});

// Screenshot upload rate limiter: 10 requests per minute
export const screenshotRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  message: {
    error: "Too many screenshot uploads. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    const ip = getClientIP(req as RateLimitRequest);
    return isTrustedIP(ip);
  },
  keyGenerator: (req: Request) => {
    // Use team member ID from token if available, otherwise IP
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      // For agent endpoints, we'll use IP since token is validated separately
      return `screenshot:${getClientIP(req as RateLimitRequest)}`;
    }
    return `screenshot:${getClientIP(req as RateLimitRequest)}`;
  },
  handler: (req: Request, res: Response) => {
    const ip = getClientIP(req as RateLimitRequest);
    markSuspiciousIP(ip);
    const rateLimitInfo = (req as RateLimitRequest).rateLimit;
    res.status(429).json({
      error: "Too many screenshot uploads. Please slow down.",
      retryAfter: Math.ceil((rateLimitInfo?.resetTime ? (typeof rateLimitInfo.resetTime === 'number' ? rateLimitInfo.resetTime : rateLimitInfo.resetTime.getTime()) - Date.now() : 60 * 1000) / 1000),
    });
  },
});

// Heartbeat rate limiter: 60 requests per minute
export const heartbeatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 heartbeats per minute
  message: {
    error: "Too many heartbeat requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    const ip = getClientIP(req as RateLimitRequest);
    return isTrustedIP(ip);
  },
  keyGenerator: (req: Request) => {
    // Use IP for heartbeat tracking
    return `heartbeat:${getClientIP(req as RateLimitRequest)}`;
  },
  handler: (req: Request, res: Response) => {
    const ip = getClientIP(req as RateLimitRequest);
    if (!isTrustedIP(ip)) {
      markSuspiciousIP(ip);
    }
    const rateLimitInfo = (req as RateLimitRequest).rateLimit;
    res.status(429).json({
      error: "Too many heartbeat requests. Please slow down.",
      retryAfter: Math.ceil((rateLimitInfo?.resetTime ? (typeof rateLimitInfo.resetTime === 'number' ? rateLimitInfo.resetTime : rateLimitInfo.resetTime.getTime()) - Date.now() : 60 * 1000) / 1000),
    });
  },
});

// Strict rate limiter for sensitive operations
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    error: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    const ip = getClientIP(req as RateLimitRequest);
    return isTrustedIP(ip);
  },
});

// Export helper functions
export { getClientIP, isTrustedIP, isSuspiciousIP };

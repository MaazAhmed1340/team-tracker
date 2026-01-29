import { Request, Response, NextFunction } from "express";
import { sanitizeObject, sanitizeString } from "../utils/validation";

/**
 * Middleware to sanitize request body
 */
export function sanitizeBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Middleware to sanitize request query parameters
 */
export function sanitizeQuery(req: Request, res: Response, next: NextFunction) {
  if (req.query && typeof req.query === "object") {
    for (const key in req.query) {
      if (typeof req.query[key] === "string") {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    }
  }
  next();
}

/**
 * Middleware to sanitize request parameters
 */
export function sanitizeParams(req: Request, res: Response, next: NextFunction) {
  if (req.params && typeof req.params === "object") {
    for (const key in req.params) {
      if (typeof req.params[key] === "string") {
        req.params[key] = sanitizeString(req.params[key]);
      }
    }
  }
  next();
}

/**
 * Combined sanitization middleware
 */
export const sanitizeInput = [sanitizeBody, sanitizeQuery, sanitizeParams];

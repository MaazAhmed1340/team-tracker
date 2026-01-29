declare module "express-rate-limit" {
  import { Request, Response, NextFunction } from "express";

  export interface RateLimitInfo {
    limit: number;
    current: number;
    remaining: number;
    resetTime: Date | number;
  }

  export interface Options {
    windowMs?: number;
    max?: number | ((req: Request) => number | Promise<number>);
    message?: string | object | ((req: Request) => string | object);
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    skip?: (req: Request) => boolean | Promise<boolean>;
    keyGenerator?: (req: Request) => string | Promise<string>;
    handler?: (req: Request & { rateLimit?: RateLimitInfo }, res: Response) => void;
    onLimitReached?: (req: Request & { rateLimit?: RateLimitInfo }, res: Response) => void;
  }

  function rateLimit(options?: Options): (req: Request, res: Response, next: NextFunction) => void;
  export default rateLimit;
  
  // Export type for convenience
  export type RateLimitRequest = Request & { rateLimit?: RateLimitInfo };
}

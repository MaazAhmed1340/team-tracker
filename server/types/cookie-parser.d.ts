declare module "cookie-parser" {
  import { Request, Response, NextFunction } from "express";
  
  interface CookieParser {
    (secret?: string | string[]): (req: Request, res: Response, next: NextFunction) => void;
  }
  
  const cookieParser: CookieParser;
  export = cookieParser;
}

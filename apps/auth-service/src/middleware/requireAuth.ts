import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../utils/jwt";

export interface AuthRequest extends Request {
  user: any;
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or malformed token." });
  }
  const token = header.split(" ")[1];
  try {
    req.user = verifyJwt(token);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
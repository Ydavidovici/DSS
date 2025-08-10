// src/middleware/requireAuth.ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { isRevoked } from "../utils/tokenBlacklist";

export interface AuthRequest extends Request {
  user?: any;
}

type RequireAuthOptions = {
  roles?: string[];          // require these roles (all by default)
  anyRole?: boolean;         // if true, any one role is enough
  checkRevocation?: boolean; // only meaningful if ATs carry a jti
};

export function requireAuth(opts: RequireAuthOptions = {}) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or malformed token." });
    }

    const token = header.slice(7);
    try {
      const payload: any = await verifyToken(token);

      // Optional: reject revoked tokens (only if your access tokens include a jti)
      if (opts.checkRevocation && payload.jti && await isRevoked(payload.jti)) {
        return res.status(401).json({ message: "Token revoked." });
      }

      // Optional: role enforcement
      if (opts.roles?.length) {
        const userRoles: string[] = Array.isArray(payload.roles) ? payload.roles : [];
        const ok = opts.anyRole
            ? opts.roles.some(r => userRoles.includes(r))
            : opts.roles.every(r => userRoles.includes(r));
        if (!ok) return res.status(403).json({ message: "Forbidden" });
      }

      // attach for downstream handlers
      req.user = payload;
      return next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
  };
}

/** Optional: attach user if present, otherwise continue unauthenticated (no 401). */
export function optionalAuth() {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return next();
    try {
      req.user = await verifyToken(header.slice(7));
    } catch {
      // ignore invalid token, proceed as anonymous
    }
    next();
  };
}

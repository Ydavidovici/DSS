import {Request, Response, NextFunction} from "express";
import {verifyToken} from "../utils/jwt";

export interface AuthRequest extends Request {
    user?: {
        sub: string;
        roles: string[];
        preferred_username?: string;
        email?: string;
        [key: string]: any;
    };
}

export function requireAuth(expectedRole?: string) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            let token = "";
            const authHeader = req.headers.authorization;

            if (authHeader?.startsWith("Bearer ")) {
                token = authHeader.split(" ")[1] ?? '';
            }

            if (!token && req.cookies && req.cookies.access_token) {
                token = req.cookies.access_token;
            }

            if (!token) {
                return res.status(401).json({message: "Authentication required"});
            }

            const {payload} = await verifyToken(token, "access");

            req.user = {
                sub: String(payload.sub),
                roles: (payload.roles as string[]) || [],
                preferred_username: payload.preferred_username as string,
                email: payload.email as string,
                ...payload,
            };

            if (expectedRole && !req.user.roles.includes(expectedRole)) {
                return res.status(403).json({message: "Insufficient permissions"});
            }

            res.setHeader("X-User-Id", req.user.sub);
            if (req.user.email) {
                res.setHeader("X-User-Email", req.user.email);
            }
            if (req.user.roles) {
                res.setHeader("X-User-Roles", req.user.roles.join(","));
            }
            if (req.user.preferred_username) {
                res.setHeader("X-User-Name", req.user.preferred_username);
            }

            next();
        } catch (err) {
            return res.status(401).json({message: 'Invalid or expired token'});
        }
    };
}
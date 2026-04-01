import {Request, Response, NextFunction} from "express";
import {jwtVerify, JWTPayload} from "jose";

export interface ServiceRequest extends Request {
    servicePayload?: JWTPayload;
}

// FIXME: migrate these for bun reqs, not express

export const validateSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("FATAL: JWT_SECRET environment variable is missing in db-service.");
    }
    return new TextEncoder().encode(process.env.JWT_SECRET);
};

export const requireServiceToken = async (
    req: ServiceRequest,
    res: Response,
    next: NextFunction,
) => {
    try {
        const secretKey = validateSecret();
        const expectedIssuer = process.env.JWT_ISSUER ?? "http://dss-auth";
        const expectedAudience = process.env.JWT_AUDIENCE ?? "db-service";

        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            res.status(401).json({
                error: {code: "UNAUTHORIZED", message: "Missing or malformed Authorization header"},
            });
            return;
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            res.status(401).json({
                error: {code: "UNAUTHORIZED", message: "Token value is missing"},
            });
            return;
        }

        const {payload} = await jwtVerify(token, secretKey, {
            issuer: expectedIssuer,
            audience: expectedAudience,
        });

        if (payload.sub !== "client_auth") {
            res.status(403).json({
                error: {code: "FORBIDDEN", message: "Invalid token type. Expected service token."},
            });
            return;
        }

        req.servicePayload = payload;
        next();
    } catch (error) {
        console.error("JWT Verification Failed:", error);
        res.status(401).json({
            error: {code: "UNAUTHORIZED", message: "Invalid or expired service token"},
        });
    }
};
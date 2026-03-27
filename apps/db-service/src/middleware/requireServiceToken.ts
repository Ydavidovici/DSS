import {Request, Response, NextFunction} from "express";
import {jwtVerify, JWTPayload} from "jose";

export interface ServiceRequest extends Request {
    servicePayload?: JWTPayload;
}

const secretString = process.env.JWT_SECRET;
if (!secretString) {
    throw new Error("FATAL: JWT_SECRET environment variable is missing in db-service.");
}
const secretKey = new TextEncoder().encode(secretString);

const expectedIssuer = process.env.JWT_ISSUER ?? "http://dss-auth";
const expectedAudience = process.env.JWT_AUDIENCE ?? "db-service";

export const requireServiceToken = async (
    req: ServiceRequest,
    res: Response,
    next: NextFunction,
): Promise<any> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({
                error: {code: "UNAUTHORIZED", message: "Missing or malformed Authorization header"},
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                error: {code: "UNAUTHORIZED", message: "Token value is missing"},
            });
        }

        const {payload} = await jwtVerify(token, secretKey, {
            issuer: expectedIssuer,
            audience: expectedAudience,
        });

        if (payload.sub !== "client_auth") {
            return res.status(403).json({
                error: {code: "FORBIDDEN", message: "Invalid token type. Expected service token."},
            });
        }

        req.servicePayload = payload;

        next();
    } catch (error) {
        console.error("JWT Verification Failed:", error);

        return res.status(401).json({
            error: {code: "UNAUTHORIZED", message: "Invalid or expired service token"},
        });
    }
};
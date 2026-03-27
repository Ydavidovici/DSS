import {randomUUID} from "crypto";
import {SignJWT, jwtVerify, JWTPayload} from "jose";

type TokenType = "access" | "refresh";

export interface JwtConfiguration {
    issuer: string;
    audience: string;
    accessTimeToLiveSeconds: number;
    refreshTimeToLiveSeconds: number;
    clockToleranceSeconds: number;
    secretKey: Uint8Array;
}

const secretString = process.env.JWT_SECRET;
if (!secretString) {
    throw new Error("JWT_SECRET environment variable is missing. Please add it to your .env file.");
}

export const jwtConfiguration: JwtConfiguration = {
    issuer: process.env.JWT_ISSUER ?? "http://dss-auth",
    audience: process.env.JWT_AUDIENCE ?? "dss-services",
    accessTimeToLiveSeconds: Number(process.env.ACCESS_TTL_SEC ?? 900),
    refreshTimeToLiveSeconds: Number(process.env.REFRESH_TTL_SEC ?? 1209600),
    clockToleranceSeconds: Number(process.env.JWT_CLOCK_TOLERANCE_SEC ?? 5),
    secretKey: new TextEncoder().encode(secretString),
};

async function signToken(
    tokenType: TokenType,
    subject: string,
    additionalPayload: JWTPayload = {},
    customTimeToLiveSeconds?: number,
    customAudience?: string
) {
    const timeToLive = customTimeToLiveSeconds ??
        (tokenType === "access"
            ? jwtConfiguration.accessTimeToLiveSeconds
            : jwtConfiguration.refreshTimeToLiveSeconds);

    const token = await new SignJWT({...additionalPayload, typ: tokenType})
    .setProtectedHeader({alg: "HS256"})
    .setIssuer(jwtConfiguration.issuer)
    .setAudience(customAudience ?? jwtConfiguration.audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(`${timeToLive}s`)
    .sign(jwtConfiguration.secretKey);

    return token;
}

export async function signUserAccessToken(input: {
    userId: string;
    roles?: unknown[];
    preferred_username?: string;
    email?: string;
    scope?: string;
    audience?: string;
    ttlSec?: number;
}) {
    return signToken(
        "access",
        input.userId,
        {
            sessionId: randomUUID(),
            roles: input.roles,
            preferred_username: input.preferred_username,
            email: input.email,
            scope: input.scope,
        },
        input.ttlSec,
        input.audience
    );
}

export async function signRefreshToken(input: {
    userId: string;
    sessionId: string;
    carry?: {
        roles?: unknown[];
        preferred_username?: string;
        email?: string;
    };
}) {
    const jsonTokenIdentifier = randomUUID();
    const token = await signToken(
        "refresh",
        input.userId,
        {
            sessionId: input.sessionId,
            jti: jsonTokenIdentifier,
            ...(input.carry || {}),
        }
    );

    return { token, jti: jsonTokenIdentifier };
}

export async function signServiceToken(parameters: {
    scope: string | string[];
    audience?: string;
    ttlSec?: number;
}) {
    const scopeString = Array.isArray(parameters.scope)
        ? parameters.scope.join(" ")
        : parameters.scope;

    return signToken(
        "access",
        "client_auth",
        {
            sessionId: randomUUID(),
            scope: scopeString,
            azp: "auth-service",
        },
        parameters.ttlSec ?? 60,
        parameters.audience ?? "db-service"
    );
}

export async function verifyToken<T extends JWTPayload>(
    token: string,
    expectedType: TokenType = "access"
) {
    const { payload } = await jwtVerify(token, jwtConfiguration.secretKey, {
        issuer: jwtConfiguration.issuer,
        audience: jwtConfiguration.audience,
        clockTolerance: jwtConfiguration.clockToleranceSeconds,
    });

    if (payload.typ !== expectedType) {
        throw new Error(`Invalid token type. Expected ${expectedType}, got ${payload.typ}`);
    }

    return {payload: payload as T};
}
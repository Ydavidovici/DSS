import jwt, { SignOptions } from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET!;
const EXPIRES_IN: SignOptions["expiresIn"] = process.env.JWT_EXPIRES_IN || "1h";

export function signJwt(
  payload: object
): string {
    return jwt.sign(payload, SECRET, { algorithm: "HS256", expiresIn: EXPIRES_IN });
}

export function verifyJwt<T = object>(
  token: string
): T {
    return jwt.verify(token, SECRET) as T;
}
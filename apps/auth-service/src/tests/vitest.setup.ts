import {vi, afterEach, afterAll} from "vitest";
import path from "path";

vi.useFakeTimers();
vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

process.env.NODE_ENV = "test";
process.env.JWT_ISSUER = "http://auth.test";
process.env.JWT_AUDIENCE = "dss-services";

process.env.CURRENT_KID = "auth_rsa";

const jwksDir = path.resolve(process.cwd(), "src/keys");
process.env.JWKS_PATH = jwksDir;
process.env.KEYS_DIR = jwksDir;

process.env.RATE_LIMIT_USE_MEMORY = "true";
process.env.COOKIE_SAMESITE = "lax";
process.env.DB_SERVICE_URL = "http://db.service.test";

process.env.ACCESS_TTL_SEC ??= "900";
process.env.REFRESH_TTL_SEC ??= "1209600";
process.env.JWT_CLOCK_TOLERANCE_SEC ??= "5";

process.env.ACCESS_TTL_SEC ??= "900";
process.env.REFRESH_TTL_SEC ??= "1209600";
process.env.JWT_CLOCK_TOLERANCE_SEC ??= "5";

afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

afterAll(() => {
    vi.useRealTimers();
});
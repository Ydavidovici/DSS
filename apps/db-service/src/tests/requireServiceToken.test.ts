import {describe, it, expect, afterAll} from "bun:test";
import {validateSecret} from "../middleware/requireServiceToken";

describe("[db-service] Middleware Configuration", () => {
    const originalSecret = process.env.JWT_SECRET;

    afterAll(() => {
        if (originalSecret) {
            process.env.JWT_SECRET = originalSecret;
        }
    });

    it("throws an error if JWT_SECRET is missing", () => {
        delete process.env.JWT_SECRET;

        expect(() => validateSecret()).toThrow("FATAL: JWT_SECRET environment variable is missing in db-service.");
    });
});
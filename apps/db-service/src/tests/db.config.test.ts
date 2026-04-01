import {describe, it, expect, afterAll} from "bun:test";
import {validateConfig} from "../config/db";

describe("[db-service] Database Configuration", () => {
    const originalUrl = process.env.DATABASE_URL;

    afterAll(() => {
        if (originalUrl) {
            process.env.DATABASE_URL = originalUrl;
        }
    });

    it("throws an error if DATABASE_URL is missing", () => {
        delete process.env.DATABASE_URL;

        expect(() => validateConfig()).toThrow("FATAL: DATABASE_URL environment variable is missing.");
    });
});
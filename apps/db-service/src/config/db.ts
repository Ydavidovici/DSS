import knex from "knex";

if (!process.env.DATABASE_URL) {
    throw new Error("FATAL: DATABASE_URL environment variable is missing.");
}

export const db = knex({
    client: "pg",
    connection: process.env.DATABASE_URL,
    pool: {
        min: 2,
        max: Number(process.env.DB_POOL_MAX) || 20,
        idleTimeoutMillis: 30000,
    },
    migrations: {
        tableName: "knex_migrations",
        directory: "./migrations",
        extension: "ts",
    },
});

export const closeDB = async () => {
    await db.destroy();
};
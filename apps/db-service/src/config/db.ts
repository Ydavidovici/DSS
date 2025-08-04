// src/config/db.ts
import Knex from 'knex';
import * as dotenv from 'dotenv';
dotenv.config();

export const knex = Knex({
  client: 'pg',
  connection: {
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT) || 5432,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    searchPath: [process.env.DB_SCHEMA || 'public']
  },
  pool: {
    min: 2,
    max: Number(process.env.DB_POOL_MAX) || 20,
    idleTimeoutMillis: 30000
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations'
  }
});
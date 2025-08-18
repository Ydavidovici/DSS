// backend/config/config.js

const dotenv = require('dotenv');

dotenv.config();

module.exports = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: process.env.DATABASE_URL || './database/dropshipping.db',
        },
        useNullAsDefault: true,
        migrations: {
            directory: './database/migrations',
        },
        seeds: {
            directory: './database/seeders',
        },
    },
    production: {
        client: 'sqlite3',
        connection: {
            filename: process.env.DATABASE_URL,
        },
        useNullAsDefault: true,
        migrations: {
            directory: './database/migrations',
        },
        seeds: {
            directory: './database/seeders',
        },
    },
};

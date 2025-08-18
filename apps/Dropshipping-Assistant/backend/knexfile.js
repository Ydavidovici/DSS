module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: './database/dropshipping.db',
    },
    useNullAsDefault: true,
    migrations: {
      directory: './database/migrations',
    },
    seeds: {
      directory: './database/seeders',
    },
  },

  // Add other environments (e.g., production) if needed
};

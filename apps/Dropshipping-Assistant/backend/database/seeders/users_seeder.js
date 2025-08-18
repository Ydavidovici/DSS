// backend/database/seeders/users_seeder.js

const bcrypt = require('bcrypt');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del();

  // Inserts seed entries
  const passwordHash = await bcrypt.hash('password123', 10);

  return knex('users').insert([
    {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      password_hash: passwordHash,
      role: 'admin',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      username: 'john_doe',
      email: 'john@example.com',
      password_hash: passwordHash,
      role: 'customer',
      created_at: new Date(),
      updated_at: new Date()
    },
    // Add more users as needed
  ]);
};

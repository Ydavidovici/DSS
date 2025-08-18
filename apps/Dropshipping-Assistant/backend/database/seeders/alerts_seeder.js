// backend/database/seeders/alerts_seeder.js

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('alerts').del();

  // Inserts seed entries
  return knex('alerts').insert([
    {
      id: 1,
      product_id: 1,
      alert_type: 'Low Demand',
      message: 'The product "Wireless Mouse" has low demand.',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      product_id: 2,
      alert_type: 'High Competition',
      message: 'The product "Bluetooth Headphones" is facing high competition.',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Add more alerts as needed
  ]);
};

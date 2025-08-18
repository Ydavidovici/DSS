// backend/database/seeders/orders_seeder.js

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('orders').del();

  // Inserts seed entries
  return knex('orders').insert([
    {
      id: 1,
      product_id: 1,
      user_id: 2,
      quantity: 2,
      total_price: 51.98, // 25.99 * 2
      status: 'Pending',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      product_id: 2,
      user_id: 2,
      quantity: 1,
      total_price: 89.99,
      status: 'Shipped',
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Add more orders as needed
  ]);
};

// backend/database/seeders/product_scores_seeder.js

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('product_scores').del();

  // Inserts seed entries
  return knex('product_scores').insert([
    {
      id: 1,
      product_id: 1,
      demand: 80,
      competition: 60,
      profit_margin: 70,
      shipping_handling: 85,
      return_rate: 40,
      seasonality: 50,
      product_restrictions: 100,
      total_score: 72,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      product_id: 2,
      demand: 90,
      competition: 55,
      profit_margin: 65,
      shipping_handling: 80,
      return_rate: 35,
      seasonality: 60,
      product_restrictions: 100,
      total_score: 74,
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Add more product scores as needed
  ]);
};

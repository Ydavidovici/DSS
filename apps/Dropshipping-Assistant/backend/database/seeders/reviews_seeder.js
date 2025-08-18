// backend/database/seeders/reviews_seeder.js

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('reviews').del();

  // Inserts seed entries
  return knex('reviews').insert([
    {
      id: 1,
      product_id: 1,
      user_id: 2,
      rating: 5,
      comment: 'Excellent mouse! Very responsive and comfortable.',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      product_id: 2,
      user_id: 2,
      rating: 4,
      comment: 'Great sound quality, but a bit pricey.',
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Add more reviews as needed
  ]);
};

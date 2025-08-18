// backend/database/seeders/categories_seeder.js

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('categories').del();

  // Inserts seed entries
  return knex('categories').insert([
    {
      id: 1,
      name: 'Electronics',
      description: 'Electronic gadgets and devices.',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      name: 'Home Appliances',
      description: 'Appliances for home use.',
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Add more categories as needed
  ]);
};

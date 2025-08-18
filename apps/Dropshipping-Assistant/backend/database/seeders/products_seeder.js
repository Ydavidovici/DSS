// backend/database/seeders/products_seeder.js

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('products').del();

  // Inserts seed entries
  return knex('products').insert([
    {
      id: 1,
      name: 'Wireless Mouse',
      description: 'A high-precision wireless mouse with ergonomic design.',
      price: 25.99,
      currency: 'USD',
      url: 'https://example.com/products/wireless-mouse',
      image_url: 'https://example.com/images/wireless-mouse.jpg',
      category: 'Electronics',
      shipping_weight: 0.2,
      shipping_dimensions: '4x2x1',
      sales_rank: 150,
      supplier_name: 'Tech Supplies Co.',
      supplier_rating: 4.5,
      supplier_contact_email: 'contact@techsuppliesco.com',
      supplier_contact_phone: '123-456-7890',
      supplier_website: 'https://techsuppliesco.com',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      name: 'Bluetooth Headphones',
      description: 'Noise-cancelling over-ear Bluetooth headphones.',
      price: 89.99,
      currency: 'USD',
      url: 'https://example.com/products/bluetooth-headphones',
      image_url: 'https://example.com/images/bluetooth-headphones.jpg',
      category: 'Electronics',
      shipping_weight: 0.5,
      shipping_dimensions: '6x4x3',
      sales_rank: 80,
      supplier_name: 'SoundWave Inc.',
      supplier_rating: 4.7,
      supplier_contact_email: 'support@soundwaveinc.com',
      supplier_contact_phone: '987-654-3210',
      supplier_website: 'https://soundwaveinc.com',
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Add more products as needed
  ]);
};

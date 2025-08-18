// backend/database/seeders/notifications_seeder.js

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('notifications').del();

  // Inserts seed entries
  return knex('notifications').insert([
    {
      id: 1,
      user_id: 1,
      alert_id: 1,
      notification_type: 'Email',
      message: 'Alert: Low demand detected for "Wireless Mouse". Consider promotions.',
      sent_at: new Date(),
      status: 'Sent',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      user_id: 1,
      alert_id: 2,
      notification_type: 'SMS',
      message: 'Alert: High competition for "Bluetooth Headphones". Monitor pricing strategies.',
      sent_at: new Date(),
      status: 'Sent',
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Add more notifications as needed
  ]);
};

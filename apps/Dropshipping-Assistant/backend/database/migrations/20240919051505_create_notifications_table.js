// backend/database/migrations/20240919044305_create_notifications_table.js

exports.up = function(knex) {
    return knex.schema.createTable('notifications', function(table) {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable()
            .references('id').inTable('users').onDelete('CASCADE');
        table.integer('alert_id').unsigned().notNullable()
            .references('id').inTable('alerts').onDelete('CASCADE');

        table.string('notification_type').notNullable(); // e.g., Email, SMS
        table.text('message').notNullable();
        table.timestamp('sent_at');
        table.string('status').notNullable().defaultTo('Pending'); // Pending, Sent, Failed

        table.timestamps(true, true); // created_at and updated_at
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('notifications');
};

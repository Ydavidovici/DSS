// backend/database/migrations/20240919044240_create_alerts_table.js

exports.up = function(knex) {
    return knex.schema.createTable('alerts', function(table) {
        table.increments('id').primary();
        table.integer('product_id').unsigned().notNullable()
            .references('id').inTable('products').onDelete('CASCADE');

        table.string('alert_type').notNullable(); // e.g., "High Competition", "Low Demand"
        table.text('message').notNullable();
        table.boolean('is_active').defaultTo(true);

        table.timestamps(true, true); // created_at and updated_at
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('alerts');
};

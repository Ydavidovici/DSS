// backend/database/migrations/20240919044245_create_orders_table.js

exports.up = function(knex) {
    return knex.schema.createTable('orders', function(table) {
        table.increments('id').primary();
        table.integer('product_id').unsigned().notNullable()
            .references('id').inTable('products').onDelete('CASCADE');
        table.integer('user_id').unsigned().notNullable()
            .references('id').inTable('users').onDelete('CASCADE');

        table.integer('quantity').notNullable().defaultTo(1);
        table.float('total_price').notNullable();
        table.string('status').notNullable().defaultTo('Pending'); // Pending, Shipped, Delivered, Cancelled

        table.timestamps(true, true); // created_at and updated_at
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('orders');
};

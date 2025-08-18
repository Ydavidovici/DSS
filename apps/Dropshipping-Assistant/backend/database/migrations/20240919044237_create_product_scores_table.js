// backend/database/migrations/20240919044237_create_product_scores_table.js

exports.up = function(knex) {
    return knex.schema.createTable('product_scores', function(table) {
        table.increments('id').primary();
        table.integer('product_id').unsigned().notNullable()
            .references('id').inTable('products').onDelete('CASCADE');

        table.integer('demand').defaultTo(0);
        table.integer('competition').defaultTo(0);
        table.integer('profit_margin').defaultTo(0);
        table.integer('shipping_handling').defaultTo(0);
        table.integer('return_rate').defaultTo(0);
        table.integer('seasonality').defaultTo(0);
        table.integer('product_restrictions').defaultTo(0);
        table.integer('total_score').defaultTo(0);

        table.timestamps(true, true); // created_at and updated_at
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('product_scores');
};

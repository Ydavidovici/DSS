// backend/database/migrations/20240919044242_create_reviews_table.js

exports.up = function(knex) {
    return knex.schema.createTable('reviews', function(table) {
        table.increments('id').primary();
        table.integer('product_id').unsigned().notNullable()
            .references('id').inTable('products').onDelete('CASCADE');
        table.integer('user_id').unsigned().notNullable()
            .references('id').inTable('users').onDelete('CASCADE');

        table.integer('rating').notNullable(); // 1-5
        table.text('comment');

        table.timestamps(true, true); // created_at and updated_at
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('reviews');
};

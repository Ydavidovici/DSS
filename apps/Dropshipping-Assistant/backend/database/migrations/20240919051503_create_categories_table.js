// backend/database/migrations/20240919044300_create_categories_table.js

exports.up = function(knex) {
    return knex.schema.createTable('categories', function(table) {
        table.increments('id').primary();
        table.string('name').unique().notNullable();
        table.text('description');

        table.timestamps(true, true); // created_at and updated_at
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('categories');
};

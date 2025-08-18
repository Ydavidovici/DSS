// backend/database/migrations/20240919044230_create_users_table.js

exports.up = function(knex) {
    return knex.schema.createTable('users', function(table) {
        table.increments('id').primary();
        table.string('username').unique().notNullable();
        table.string('email').unique().notNullable();
        table.string('password_hash').notNullable();
        table.string('role').notNullable().defaultTo('customer'); // Roles: admin, customer
        table.timestamps(true, true); // created_at and updated_at
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('users');
};

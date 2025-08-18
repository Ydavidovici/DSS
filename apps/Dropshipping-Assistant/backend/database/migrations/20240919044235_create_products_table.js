// backend/database/migrations/20240919044235_create_products_table.js

exports.up = function(knex) {
    return knex.schema.createTable('products', function(table) {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.text('description');
        table.float('price').notNullable();
        table.string('currency').defaultTo('USD');
        table.string('url').unique().notNullable();
        table.string('image_url');
        table.string('category');
        table.float('shipping_weight');
        table.string('shipping_dimensions');
        table.integer('sales_rank');

        // Embedded Supplier Information
        table.string('supplier_name');
        table.float('supplier_rating').defaultTo(0);
        table.string('supplier_contact_email');
        table.string('supplier_contact_phone');
        table.string('supplier_website');

        table.timestamps(true, true); // created_at and updated_at
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('products');
};

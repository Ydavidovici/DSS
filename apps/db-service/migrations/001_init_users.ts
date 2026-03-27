import {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable("users", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
        table.string("first_name");
        table.string("last_name");
        table.string("email", 255).notNullable().unique();
        table.string("password_hash", 255).notNullable();
        table.boolean("verified").notNullable().defaultTo(false);
        table.timestamp("verified_at", {useTz: true}).nullable();
        table.timestamps(true, true);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTableIfExists("users");
}
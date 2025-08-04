import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('player_stats', table => {
    table.increments('player_id').primary();
    table.string('name', 100).notNullable().unique();
    table.integer('wins').notNullable().defaultTo(0);
    table.integer('losses').notNullable().defaultTo(0);
    table.integer('draws').notNullable().defaultTo(0);
  });
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_player_stats_name ON player_stats(name);'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('player_stats');
}
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('games', table => {
    table.increments('game_id').primary();
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time');
    table.text('result');
    table.string('player1_name', 100).notNullable();
    table.string('player2_name', 100).notNullable();
  });
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_games_start_time ON games(start_time);'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('games');
}
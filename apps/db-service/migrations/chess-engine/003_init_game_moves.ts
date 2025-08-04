import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('game_moves', table => {
    table.integer('game_id').notNullable();
    table.integer('move_number').notNullable();
    table.text('move_notation');
    table.primary(['game_id', 'move_number']);
    table
      .foreign('game_id')
      .references('games.game_id')
      .onDelete('CASCADE');
  });
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_game_moves_game_id ON game_moves(game_id);'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('game_moves');
}
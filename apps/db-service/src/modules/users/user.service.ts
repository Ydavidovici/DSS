import { knex } from '../../config/db';
import type { UserDB, UserPublic } from './user.model';
import bcrypt from 'bcryptjs';

const TABLE = 'users';

export async function createUser(input: {
  username: string;
  email: string;
  password: string;
  roles?: unknown[];
  verified?: boolean;
}): Promise<UserPublic> {
  const password_hash = await bcrypt.hash(input.password, 12);

  try {
    const [row] = await knex<UserDB>(TABLE)
      .insert({
        username: input.username,
        email: input.email,
        password_hash,
        roles: JSON.stringify(input.roles ?? []),
        verified: input.verified ?? false
      })
      .returning('*');

    if (!row) throw new Error('INSERT_FAILED');
    const { password_hash: _ph, ...pub } = row;
    return { ...pub, roles: Array.isArray(pub.roles) ? pub.roles : [] };
  } catch (err: any) {
    if (err?.code === '23505') {
      err.httpCode = 409;
      err.public = { code: 'DUPLICATE', message: 'Username or email already exists' };
    }
    throw err;
  }
}

export async function getByUsername(username: string): Promise<UserPublic | null> {
  const row = await knex<UserDB>(TABLE)
    .where({ username })
    .andWhereNull('deleted_at')
    .first();
  if (!row) return null;
  const { password_hash: _ph, ...pub } = row;
  return { ...pub, roles: Array.isArray(pub.roles) ? pub.roles : [] };
}

export async function getByEmail(email: string): Promise<UserPublic | null> {
  const row = await knex<UserDB>(TABLE)
    .where({ email })
    .andWhereNull('deleted_at')
    .first();
  if (!row) return null;
  const { password_hash: _ph, ...pub } = row;
  return { ...pub, roles: Array.isArray(pub.roles) ? pub.roles : [] };
}

// INTERNAL for auth-service (returns password_hash as well)
export async function getRawByUsername(username: string): Promise<UserDB | null> {
  return await knex<UserDB>(TABLE)
    .where({ username })
    .andWhereNull('deleted_at')
    .first() ?? null;
}

export async function updateUser(id: string, patch: {
  verified?: boolean;
  password?: string;
  roles?: unknown[];
}): Promise<UserPublic | null> {
  const updates: Partial<UserDB> = { updated_at: new Date().toISOString() };
  if (typeof patch.verified === 'boolean') updates.verified = patch.verified;
  if (patch.roles) updates.roles = JSON.stringify(patch.roles);
  if (patch.password) updates.password_hash = await bcrypt.hash(patch.password, 12);

  try {
    const [row] = await knex<UserDB>(TABLE)
      .where({ id })
      .andWhereNull('deleted_at')
      .update(updates)
      .returning('*');

    if (!row) return null;
    const { password_hash: _ph, ...pub } = row;
    return { ...pub, roles: Array.isArray(pub.roles) ? pub.roles : [] };
  } catch (err: any) {
    if (err?.code === '23505') {
      err.httpCode = 409;
      err.public = { code: 'DUPLICATE', message: 'Username or email already exists' };
    }
    throw err;
  }
}

export async function softDeleteUser(id: string): Promise<boolean> {
  const count = await knex<UserDB>(TABLE)
    .where({ id })
    .andWhereNull('deleted_at')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  return count > 0;
}
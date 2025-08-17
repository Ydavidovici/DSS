// src/modules/users/user.service.ts
import { knex } from '../../config/db';
import type { UserDB, UserPublic } from './user.model';
import bcrypt from 'bcryptjs';

const TABLE = 'users';
const BCRYPT_ROUNDS = 12;

/** Robustly normalize roles from DB into an array */
function asRolesArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (raw == null) return [];
    try {
        if (typeof raw === 'string') {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        }
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

function toPublic(row: UserDB): UserPublic {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...rest } = row as any;
    return {
        ...(rest as any),
        roles: asRolesArray((row as any).roles),
    };
}

/* --------------------------------- CREATE --------------------------------- */

type CreateInput =
    | { username: string; email: string; password: string; roles?: unknown[]; verified?: boolean; verified_at?: string }
    | { username: string; email: string; password_hash: string; roles?: unknown[]; verified?: boolean; verified_at?: string };

export async function createUser(input: CreateInput): Promise<UserPublic> {
    const password_hash =
        'password' in input
            ? await bcrypt.hash(input.password, BCRYPT_ROUNDS)
            : (input as any).password_hash;

    const toInsert: Partial<UserDB> = {
        username: input.username,
        email: input.email,
        password_hash,
        roles: JSON.stringify(input.roles ?? []),
        verified: input.verified ?? false,
        ...(input.verified_at ? { verified_at: input.verified_at } : {}),
    };

    try {
        const [row] = await knex<UserDB>(TABLE).insert(toInsert).returning('*');
        if (!row) throw new Error('INSERT_FAILED');
        return toPublic(row);
    } catch (err: any) {
        if (err?.code === '23505') {
            err.httpCode = 409;
            err.public = { code: 'DUPLICATE', message: 'Username or email already exists' };
        }
        throw err;
    }
}

/* ---------------------------------- READ ---------------------------------- */

export async function getByUsername(username: string): Promise<UserPublic | null> {
    const row = await knex<UserDB>(TABLE)
        .where({ username })
        .andWhereNull('deleted_at')
        .first();
    return row ? toPublic(row) : null;
}

export async function getByEmail(email: string): Promise<UserPublic | null> {
    const row = await knex<UserDB>(TABLE)
        .where({ email })
        .andWhereNull('deleted_at')
        .first();
    return row ? toPublic(row) : null;
}

/** INTERNAL: includes password_hash (for server-side verify only) */
export async function getRawByUsername(username: string): Promise<UserDB | null> {
    const row = await knex<UserDB>(TABLE)
        .where({ username })
        .andWhereNull('deleted_at')
        .first();
    return row ?? null;
}

/** INTERNAL: includes password_hash (for server-side verify only) */
export async function getRawByEmail(email: string): Promise<UserDB | null> {
    const row = await knex<UserDB>(TABLE)
        .where({ email })
        .andWhereNull('deleted_at')
        .first();
    return row ?? null;
}

/* --------------------------------- UPDATE --------------------------------- */

type UpdateInput =
    | { verified?: boolean; verified_at?: string; roles?: unknown[]; password?: string; password_hash?: string }
    | Record<string, never>;

export async function updateUser(id: string, patch: UpdateInput): Promise<UserPublic | null> {
    const updates: Partial<UserDB> = {
        updated_at: new Date().toISOString(),
    };

    // verified / verified_at
    if (typeof patch.verified === 'boolean') updates.verified = patch.verified;
    if (patch.verified_at) updates.verified_at = patch.verified_at;

    // roles — allow empty array [] to clear
    if ('roles' in patch) updates.roles = JSON.stringify(patch.roles ?? []);

    // password/password_hash
    if (patch.password && patch.password_hash) {
        // controller should prevent this; guard just in case
        throw Object.assign(new Error('Provide only one of password or password_hash'), { httpCode: 400 });
    }
    if (patch.password) {
        updates.password_hash = await bcrypt.hash(patch.password, BCRYPT_ROUNDS);
    } else if (patch.password_hash) {
        updates.password_hash = patch.password_hash;
    }

    try {
        const [row] = await knex<UserDB>(TABLE)
            .where({ id })
            .andWhereNull('deleted_at')
            .update(updates)
            .returning('*');

        return row ? toPublic(row) : null;
    } catch (err: any) {
        if (err?.code === '23505') {
            err.httpCode = 409;
            err.public = { code: 'DUPLICATE', message: 'Username or email already exists' };
        }
        throw err;
    }
}

/* --------------------------------- DELETE --------------------------------- */

export async function softDeleteUser(id: string): Promise<boolean> {
    const count = await knex<UserDB>(TABLE)
        .where({ id })
        .andWhereNull('deleted_at')
        .update({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

    return count > 0;
}

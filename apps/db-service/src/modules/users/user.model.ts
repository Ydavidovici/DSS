export type UserDB = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  verified: boolean;
  roles: unknown[]; // JSONB
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type UserPublic = Omit<UserDB, 'password_hash'>;

export const toPublic = (u: UserDB): UserPublic => {
  const { password_hash, ...rest } = u;
  return { ...rest, roles: Array.isArray(rest.roles) ? rest.roles : [] };
};
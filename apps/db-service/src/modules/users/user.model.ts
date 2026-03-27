export interface User {
    id: string; // UUID
    first_name: string | null;
    last_name: string | null;
    email: string;
    password_hash: string;
    verified: boolean;
    verified_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateUserDTO {
    first_name?: string;
    last_name?: string;
    email: string;
    password_hash: string;
}

export interface UpdateUserDTO {
    first_name?: string;
    last_name?: string;
    password_hash?: string;
    verified?: boolean;
    verified_at?: Date | null;
}
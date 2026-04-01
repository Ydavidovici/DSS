import {db} from "../../config/db";
import {User, CreateUserDTO, UpdateUserDTO} from "./user.model";

// FIXME: lets make these use transactions

export const createUser = async (data: CreateUserDTO): Promise<User> => {
    const [user] = await db<User>("users").insert(data).returning("*");

    if (!user) {
        throw new Error("Database failed to return the created user.");
    }

    return user;
};

export const getUserById = async (id: string): Promise<User | undefined> => {
    return db<User>("users").where({id}).first();
};

export const getUserByEmail = async (email: string): Promise<User | undefined> => {
    return db<User>("users").where({email}).first();
};

export const updateUser = async (id: string, data: UpdateUserDTO): Promise<User | undefined> => {
    const [updatedUser] = await db<User>("users")
    .where({id})
    .update({
        ...data,
        updated_at: new Date(),
    })
    .returning("*");

    return updatedUser;
};

export const deleteUser = async (id: string): Promise<boolean> => {
    const rowsDeleted = await db("users").where({id}).del();
    return rowsDeleted > 0;
};
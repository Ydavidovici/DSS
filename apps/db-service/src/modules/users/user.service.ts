import {Knex} from "knex";
import {db as databaseConnection} from "../../config/db";
import {User, CreateUserDTO, UpdateUserDTO} from "./user.model";

export const createUser = async (userDataToInsert: CreateUserDTO, databaseTransaction?: Knex.Transaction): Promise<User> => {
    const activeDatabaseClient = databaseTransaction || databaseConnection;

    const [createdUser] = await activeDatabaseClient<User>("users").insert(userDataToInsert).returning("*");

    if (!createdUser) {
        throw new Error("Database failed to return the created user.");
    }

    return createdUser;
};

export const getUserById = async (userIdentifier: string, databaseTransaction?: Knex.Transaction): Promise<User | undefined> => {
    const activeDatabaseClient = databaseTransaction || databaseConnection;
    return activeDatabaseClient<User>("users").where({id: userIdentifier}).first();
};

export const getUserByEmail = async (userEmailAddress: string, databaseTransaction?: Knex.Transaction): Promise<User | undefined> => {
    const activeDatabaseClient = databaseTransaction || databaseConnection;
    return activeDatabaseClient<User>("users").where({email: userEmailAddress}).first();
};

export const updateUser = async (userIdentifier: string, userDataToUpdate: UpdateUserDTO, databaseTransaction?: Knex.Transaction): Promise<User | undefined> => {
    const activeDatabaseClient = databaseTransaction || databaseConnection;

    const [updatedUser] = await activeDatabaseClient<User>("users")
    .where({id: userIdentifier})
    .update({
        ...userDataToUpdate,
        updated_at: new Date(),
    })
    .returning("*");

    return updatedUser;
};

export const deleteUser = async (userIdentifier: string, databaseTransaction?: Knex.Transaction): Promise<boolean> => {
    const activeDatabaseClient = databaseTransaction || databaseConnection;
    const numberOfDeletedRows = await activeDatabaseClient("users").where({id: userIdentifier}).del();
    return numberOfDeletedRows > 0;
};
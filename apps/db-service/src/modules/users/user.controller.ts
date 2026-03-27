import {Request, Response} from "express";
import * as userService from "./user.service";

export const createUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const {first_name, last_name, email, password_hash} = req.body;

        if (!email || !password_hash) {
            res.status(400).json({
                error: {code: "VALIDATION_ERROR", message: "Missing email or password_hash"},
            });
            return;
        }

        const newUser = await userService.createUser({
            first_name,
            last_name,
            email,
            password_hash,
        });

        res.status(201).json({data: newUser});
    } catch (error: any) {
        if (error.code === "23505") {
            res.status(409).json({
                error: {code: "CONFLICT", message: "User with this email already exists"},
            });
            return;
        }

        throw error;
    }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
        const {id} = req.params;
        if (!id || typeof id !== "string") {
            res.status(400).json({error: {code: "VALIDATION_ERROR", message: "Valid ID parameter is required"}});
            return;
        }


        const user = await userService.getUserById(id);

        if (!user) {
            res.status(404).json({error: {code: "NOT_FOUND", message: "User not found"}});
            return;
        }

        res.status(200).json({data: user});
    } catch (error) {
        throw error;
    }
};

export const getUserByEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawEmail = req.params.email;

        if (!rawEmail || typeof rawEmail !== "string") {
            res.status(400).json({
                error: {code: "VALIDATION_ERROR", message: "Valid email parameter is required"},
            });
            return;
        }

        const email = decodeURIComponent(rawEmail);

        const user = await userService.getUserByEmail(email);

        if (!user) {
            res.status(404).json({error: {code: "NOT_FOUND", message: "User not found"}});
            return;
        }

        res.status(200).json({data: user});
    } catch (error) {
        throw error;
    }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const {id} = req.params;

        if (!id || typeof id !== "string") {
            res.status(400).json({error: {code: "VALIDATION_ERROR", message: "Valid ID parameter is required"}});
            return;
        }

        const updates = req.body;

        delete updates.id;

        if (Object.keys(updates).length === 0) {
            res.status(400).json({
                error: {code: "VALIDATION_ERROR", message: "No valid fields provided for update"},
            });
            return;
        }

        const updatedUser = await userService.updateUser(id, updates);

        if (!updatedUser) {
            res.status(404).json({error: {code: "NOT_FOUND", message: "User not found"}});
            return;
        }

        res.status(200).json({data: updatedUser});
    } catch (error) {
        throw error;
    }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const {id} = req.params;

        if (!id || typeof id !== "string") {
            res.status(400).json({error: {code: "VALIDATION_ERROR", message: "Valid ID parameter is required"}});
            return;
        }

        const wasDeleted = await userService.deleteUser(id);

        if (!wasDeleted) {
            res.status(404).json({error: {code: "NOT_FOUND", message: "User not found"}});
            return;
        }

        res.status(204).send();
    } catch (error) {
        throw error;
    }
};
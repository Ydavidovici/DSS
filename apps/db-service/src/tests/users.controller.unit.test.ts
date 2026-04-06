import { describe, it, expect, mock, spyOn } from "bun:test";
import { Request, Response } from "express";
import * as controller from "../modules/users/user.controller";
import * as userService from "../modules/users/user.service";

describe("[db-service] User Controller Edge Cases", () => {
    const mockRes = () => {
        const res: Partial<Response> = {};
        res.status = mock().mockReturnValue(res);
        res.json = mock().mockReturnValue(res);
        return res as Response;
    };

    it("getUserById requires valid id", async () => {
        const res = mockRes();
        await controller.getUserById({ params: {} } as unknown as Request, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it("getUserByEmail requires valid email", async () => {
        const res = mockRes();
        await controller.getUserByEmail({ params: {} } as unknown as Request, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it("updateUser requires valid id", async () => {
        const res = mockRes();
        await controller.updateUser({ params: {}, body: {} } as unknown as Request, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it("deleteUser requires valid id", async () => {
        const res = mockRes();
        await controller.deleteUser({ params: {} } as unknown as Request, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it("createUser throws unhandled errors", async () => {
        spyOn(userService, "createUser").mockRejectedValueOnce(new Error("DB Crash"));
        const req = { body: { email: "test@example.com", password_hash: "123" } } as unknown as Request;
        await expect(controller.createUser(req, mockRes())).rejects.toThrow("DB Crash");
    });

    it("getUserById throws unhandled errors", async () => {
        spyOn(userService, "getUserById").mockRejectedValueOnce(new Error("DB Crash"));
        await expect(
            controller.getUserById({ params: { id: "123" } } as unknown as Request, mockRes())
        ).rejects.toThrow("DB Crash");
    });

    it("getUserByEmail throws unhandled errors", async () => {
        spyOn(userService, "getUserByEmail").mockRejectedValueOnce(new Error("DB Crash"));
        await expect(
            controller.getUserByEmail({ params: { email: "test@test.com" } } as unknown as Request, mockRes())
        ).rejects.toThrow("DB Crash");
    });

    it("updateUser throws unhandled errors", async () => {
        spyOn(userService, "updateUser").mockRejectedValueOnce(new Error("DB Crash"));
        await expect(
            controller.updateUser({ params: { id: "123" }, body: { first_name: "test" } } as unknown as Request, mockRes())
        ).rejects.toThrow("DB Crash");
    });

    it("deleteUser throws unhandled errors", async () => {
        spyOn(userService, "deleteUser").mockRejectedValueOnce(new Error("DB Crash"));
        await expect(
            controller.deleteUser({ params: { id: "123" } } as unknown as Request, mockRes())
        ).rejects.toThrow("DB Crash");
    });
});
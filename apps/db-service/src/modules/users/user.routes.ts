import {Router} from "express";
import * as userController from "./user.controller";
import {requireServiceToken} from "../../middleware/requireServiceToken";

const router = Router();

router.use(requireServiceToken);

router.get("/email/:email", userController.getUserByEmail);

router.get("/:id", userController.getUserById);

router.post("/", userController.createUser);

router.patch("/:id", userController.updateUser);

router.delete("/:id", userController.deleteUser);

export default router;
import { Router } from "express";
import { signJwt } from "../utils/jwt";

const router = Router();

router.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (username !== "admin" || password !== "password123") {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = signJwt({ username });
    res.json({ token });
});

export default router;
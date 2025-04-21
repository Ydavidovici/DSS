import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

router.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (username !== "admin" || password !== "password123") {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ username }, process.env.JWT_SECRET!, { expiresIn: "1h" });
    res.json({ token });
});

export default router;

import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import { requireAuth, AuthRequest } from "./middleware/requireAuth";

dotenv.config();
const app = express();
app.use(express.json());

app.use("/auth", authRoutes);

// token-introspection
app.get("/auth/verify", requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user });
});

app.listen(process.env.PORT, () =>
  console.log(`Auth service listening on ${process.env.PORT}`)
);
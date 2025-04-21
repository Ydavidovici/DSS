import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use("/auth", authRoutes);

app.get("/", (req, res) => {
    res.send("Auth service is live 🚀");
});

app.listen(PORT, () => {
    console.log(`Auth service running on http://localhost:${PORT}`);
});

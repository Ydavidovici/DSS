import express from "express";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

app.get("/*", (_, res) => {
    res.sendFile(path.join(process.cwd(), "public","pages", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Frontend running on http://localhost:${PORT}`);
});

import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// serve all files under public/
app.use(express.static(join(__dirname, "public")));

app.get("*", (req, res) => {
  // if no static file matches, serve index.html
  res.sendFile(join(__dirname, "public/pages/index.html"));
});

app.listen(3000, "0.0.0.0", () => {
  console.log("🚀 Listening on http://0.0.0.0:3000");
});

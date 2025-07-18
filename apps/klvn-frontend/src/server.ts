import express from "express";
import path from "path";

// Create an Express application
const app = express();

// Use the environment PORT or default to 3000
const PORT = process.env.PORT || 3001;

// Define the directory where static assets are located
const publicDir = path.join(__dirname, "..", "public");

// Serve static files (HTML, CSS, JS, images, etc.)
app.use(express.static(publicDir));

// Route for the main frontend
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Route for the admin page
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`KLVN-frontend server is running at http://localhost:${PORT}`);
});
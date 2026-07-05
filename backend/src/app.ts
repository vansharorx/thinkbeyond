import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("ThinkBeyond Backend is Running 🚀");
});

export default app;
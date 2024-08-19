import express from "express";
import dotenv from "dotenv";
import { processTask } from "./processTask";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.post("/process", async (req, res) => {
  const {
    taskId,
    files,
    generatorId,
    numKeywords,
    userId,
    apiKey,
    apiType,
    ourApi,
  } = req.body;

  // Start processing the task asynchronously
  processTask(
    taskId,
    files,
    generatorId,
    numKeywords,
    userId,
    apiKey,
    apiType,
    ourApi
  ).catch((error) => console.error("Error processing task:", error));

  res.status(200).json({ success: true, msg: "Task processing started" });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`Processing server is running on port ${PORT}`);
});


import { PrismaClient } from "@prisma/client";

import { getMetadadataByFilename } from "./utils/apiUtils";
import { generatePrompt } from "./utils/promptUtils";
import { updateUserCredits } from "./utils/userUtils";
import {
  CREDITS_PER_FILE_WITH_OUR_API,
  CREDITS_PER_FILE_WITH_USER_API,
  generators,
  PROCESS_FILES_AT_A_TIME,
  UPDATE_INTERVAL,
} from "./utils/config";
import { ExtendedFile, Generator } from "./types";

const prisma = new PrismaClient();

export async function processTask(
  taskId: string,
  files: any[],
  generatorId: number,
  numKeywords: number,
  userId: string,
  apiKey: string,
  apiType: "OPENAI" | "GEMINI",
  ourApi: boolean
) {
  const generator = generators.find((g) => g.id === generatorId);
  if (!generator) {
    throw new Error("Invalid generator ID");
  }

  let results: any[] = [];
  let lastUpdateTime = Date.now();
  let processedImages = 0;
  let failedImages = 0;

  const updateProgress = async (force = false) => {
    const currentTime = Date.now();
    if (force || currentTime - lastUpdateTime >= UPDATE_INTERVAL) {
      await prisma.tasks.update({
        where: { id: taskId },
        data: {
          progress: processedImages,
          result: results,
          status:
            processedImages + failedImages === files.length
              ? "COMPLETED"
              : "PROCESSING",
        },
      });
      lastUpdateTime = currentTime;
    }
  };

  const processSingleFile = async (file: any, retryCount = 0) => {
    try {
      const prompt = generatePrompt(generator, numKeywords);
      console.log("Prompt:", prompt);
      const result = await getMetadadataByFilename({
        filename: file.title,
        [apiType === "OPENAI" ? "openAiApiKey" : "geminiApiKey"]: apiKey,
        metadataPrompt: prompt,
      });
      console.log("Result:", result);
      if (!result.success) {
        throw new Error(result.msg);
      }

      processedImages++;
      const processedMetadata = processMetadata(result.data, file, generator);
      results.push({
        id: file.id,
        metadata: { ...processedMetadata, status: true },
      });
    } catch (error) {
      console.error("Error processing file:", file.title, error);

      if (retryCount < 2) {
        console.log(`Retrying file: ${file.title}, attempt ${retryCount + 1}`);
        await processSingleFile(file, retryCount + 1);
      } else {
        failedImages++;
        results.push({
          id: file.id,
          metadata: { status: false },
        });
      }
    }

    await updateProgress();
  };

  try {
    await Promise.all(files.map((file) => processSingleFile(file)));

    const creditsUsed =
      processedImages *
      (ourApi ? CREDITS_PER_FILE_WITH_OUR_API : CREDITS_PER_FILE_WITH_USER_API);
    console.log("Credits used:", creditsUsed);
    await updateUserCredits(userId, creditsUsed, "USAGE");

    await updateProgress(true);
  } catch (error) {
    console.error("Error processing files:", error);
    if (failedImages === files.length) {
      await prisma.tasks.update({
        where: { id: taskId },
        data: { status: "FAILED" },
      });
    }
  }
}

function processMetadata(
  metadata: any,
  file: ExtendedFile,
  generator: Generator
) {
  // string to json metadata
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch (error) {
      console.error("Error parsing metadata:", error);
      metadata = {};
    }
  }

  let fileName = file.filename;
  if (generator.id === 4) {
    fileName = fileName.replace(/\s+/g, "_");
  }

  const baseMetadata: { [key: string]: any } = {
    [generator.csvRequirements.structure[0]]: fileName,
  };

  generator.csvRequirements.generate.forEach((field) => {
    if (metadata[field]) {
      baseMetadata[field] = metadata[field];
    }
  });

  switch (generator.id) {
    case 1:
      baseMetadata.Category = metadata.Category ?? 8;
      break;
    case 3:
      baseMetadata.Prompt = metadata.Title;
      baseMetadata.Model = "Midjourney 5";
      break;
    case 6:
      baseMetadata.Category1 = 0;
      baseMetadata.Category2 = 0;
      baseMetadata.Category3 = 0;
      break;
  }

  return baseMetadata;
}

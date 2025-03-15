import { PrismaClient } from "@prisma/client";

import { ExtendedFile, Generator } from "./types";
import {
  getMetadadataByFilename,
  getMetadadataByImage,
} from "./utils/apiUtils";
import {
  generators,
  UPDATE_INTERVAL,
} from "./utils/config";
import { generatePrompt } from "./utils/promptUtils";

const prisma = new PrismaClient();

export async function processTask(
  taskId: string,
  files: {
    id: string;
    title: string;
    url: string;
  }[],
  generatorId: number,
  numKeywords: number,
  titleChars: number,
  userId: string,
  apiKey: string,
  apiType: "OPENAI" | "GEMINI",
  ourApi: boolean,
  useVision: boolean
) {
  try {

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
        await prisma.task.update({
          where: { id: taskId },
          data: {
            progress: processedImages,
            result: results,
            aiProvider: apiType,
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
        const prompt = generatePrompt(generator, numKeywords, titleChars);
        let result;
        if (useVision) {
          result = await getMetadadataByImage({
            url: file.url,
            [apiType === "OPENAI" ? "openAiApiKey" : "geminiApiKey"]: apiKey,
            metadataPrompt: prompt,
          });
        } else {
          result = await getMetadadataByFilename({
            filename: file.title,
            [apiType === "OPENAI" ? "openAiApiKey" : "geminiApiKey"]: apiKey,
            metadataPrompt: prompt,
          });
        }
        if (!result.success) {
          throw new Error(result.msg);
        }
        processedImages++;
        const processedMetadata = processMetadata(result.data, file, generator);
        results.push({
          id: file.id,
          metadata: { ...processedMetadata, status: true },
          usageMetadata: result.usageMetadata,
        });
      } catch (error) {
        console.log("Error processing file:", file.title, error);

        if (retryCount < 2) {
          console.log(
            `Retrying file: ${file.title}, attempt ${retryCount + 1}`
          );
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
      // if apitype is gemini, only process 1 file at a time and max 15 per minute else processall at once
      if (apiType === "GEMINI") {
        const now = Date.now();
        const delay = 4000; // Delay in milliseconds (15 files per minute = 4 seconds per file)

        for (let i = 0; i < files.length; i++) {
          await processSingleFile(files[i]);

          if (i < files.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      } else {
        await Promise.all(files.map((file) => processSingleFile(file)));
      }
      await updateProgress(true);
    } catch (error) {
      console.error("Error processing files:", error);
      if (failedImages === files.length) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "FAILED" },
        });
      }
    }
  } catch (error) {
    console.error("Error processing task:", error);
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "FAILED" },
    });
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
      // check if { and } are present in the string
      if (metadata.indexOf("{") !== -1 && metadata.indexOf("}") !== -1) {
        //  if there is anythin outside of {} remove it and get the json object
        const jsonString = metadata.match(/\{([^}]+)\}/)?.[0];
        metadata = JSON.parse(jsonString ?? "{}");
        // if Keywords is present in metadata, and it is a string, convert it to array
        if (metadata.Keywords && typeof metadata.Keywords === "string") {
          metadata.Keywords = metadata.Keywords.split(",");
        }
      } else {
        // throw error if metadata is not in json format
        throw new Error("Metadata is not in JSON format");
      }
    } catch (error) {
      console.error("Error parsing metadata:", error);
      metadata = {};
    }
  }

  let fileName = file.filename;
  if (generator.id === 4) {
    fileName = fileName.replace(/_/g, "");
    fileName = fileName.replace(/\s+/g, "_");
    fileName = fileName.replace(/\(/g, "_");
    fileName = fileName.replace(/\)/g, "_");
  }

  const baseMetadata: { [key: string]: any } = {
    [generator.csvRequirements.structure[0]]: fileName,
  };

  generator.csvRequirements.generate.forEach((field) => {
    if (metadata[field]) {
      if (field === "Title") {
        baseMetadata[field] = metadata[field]
          .replace(/-/g, " ")
          .replace(/[^a-zA-Z0-9 ]/g, "");
      } else {
        baseMetadata[field] = metadata[field];
      }
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

import { GoogleAIFileManager } from "@google/generative-ai/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import fs from "fs";

export const getMetadadataByFilename = async ({
  openAiApiKey,
  geminiApiKey,
  filename,
  metadataPrompt,
}: {
  filename: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  metadataPrompt: string;
}) => {
  if (openAiApiKey) {
    const client = new OpenAI({
      apiKey: openAiApiKey,
    });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: metadataPrompt,
        },
        {
          role: "user",
          content: `Get metadata for ${filename}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    if (response.choices.length === 0) {
      return { success: false, msg: "No response from OpenAI" };
    }

    const metadata = response.choices[0].message.content;
    return { success: true, data: metadata };
  } else if (geminiApiKey) {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    try {
      const joinedPrompt = `${metadataPrompt}. /n Generate metadata for ${filename}`;
      const response = await model.generateContent(joinedPrompt);
      const chatResponse = response.response?.text() || "";
      return { success: true, data: chatResponse };
    } catch (error) {
      return { success: false, msg: "Something went wrong" };
    }
  } else {
    return { success: false, msg: "No API key provided" };
  }
};

export const getMetadadataByImage = async ({
  openAiApiKey,
  geminiApiKey,
  url,
  metadataPrompt,
}: {
  url: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  metadataPrompt: string;
}) => {
  if (openAiApiKey) {
    const client = new OpenAI({
      apiKey: openAiApiKey,
    });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: metadataPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyse this image and generate required metadata",
            },
            {
              type: "image_url",
              image_url: {
                url: url,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    if (response.choices.length === 0) {
      return { success: false, msg: "No response from OpenAI" };
    }

    const metadata = response.choices[0].message.content;
    return { success: true, data: metadata };
  } else if (geminiApiKey) {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const fileManager = new GoogleAIFileManager(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    // download image
    const image = await fetch(url);
    const filename = url.split("/").pop();
    // save image
    fs.writeFileSync(`./${filename}`, await image.buffer());

    const uploadResponse = await fileManager.uploadFile(`./${filename}`, {
      mimeType: "image/jpeg",
      displayName: filename?.split(".")[0],
    });

    try {
      const joinedPrompt = `${metadataPrompt}. /n Analyse this image and generate required metadata`;
      const response = await model.generateContent([
        {
          fileData: {
            fileUri: uploadResponse.file.uri,
            mimeType: "image/jpeg",
          },
        },
        {
          text: joinedPrompt,
        },
      ]);
      const chatResponse = response.response?.text() || "";
      // delete image
      fs.unlinkSync(`./${filename}`);
      return { success: true, data: chatResponse };
    } catch (error) {
      console.log(error);
      return { success: false, msg: "Something went wrong" };
    }
  } else {
    return { success: false, msg: "No API key provided" };
  }
};

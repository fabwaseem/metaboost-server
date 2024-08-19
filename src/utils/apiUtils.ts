import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateText } from "ai";

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
  let provider = null;
  let selectedProvider = null;
  if (openAiApiKey) {
    provider = createOpenAI({
      apiKey: openAiApiKey,
    });
    selectedProvider = "OpenAI";
  } else if (geminiApiKey) {
    provider = createGoogleGenerativeAI({
      apiKey: geminiApiKey,
    });
    selectedProvider = "Google";
  }
  if (!provider) {
    throw new Error("No API key provided");
  }
  try {
    const { text } = await generateText({
      model: provider(
        selectedProvider === "Google"
          ? "models/gemini-1.5-pro-latest"
          : "gpt-3.5-turbo"
      ),

      system: metadataPrompt,
      prompt: ` ${
        selectedProvider === "Google" ? metadataPrompt : ""
      }. Generate a metadata for ${filename} `,
    });

    const parsedJson = JSON.parse(text);
    return { success: true, data: parsedJson };
  } catch (error: any) {
    if (error instanceof APICallError) {
      return { success: false, msg: error.message };
    }

    if (error instanceof SyntaxError) {
      return {
        success: false,
        msg: "Failed to parse the generated metadata. Please try again.",
      };
    }

    return {
      success: false,
      msg: "An unexpected error occurred. Please check your API key and try again.",
    };
  }
};
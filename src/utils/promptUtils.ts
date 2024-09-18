import { Generator } from "../types";

export const generatePrompt = (
  generator: Generator,
  numKeywords: number,
  titleChars: number
): string => {
  const { title, csvRequirements } = generator;
  const requiredFields = csvRequirements.generate;

  let prompt = `You are an expert ${title} metadata JSON writer. Generate the following fields for images based on the provided details: ${requiredFields.join(
    ", "
  )}.Follow the case as provides don't make lowercase every key. if there is title in fields Keep the title explanatory and what can be the usage of image and title should be close to and max ${titleChars} characters. If there is description field in the metadata, provide a detailed description of the image with usage and other details of more than 100 and maximum 200 character. Avoid using the same keyword more than once and only give one word keywords. Give exact ${numKeywords} number of keywords. First 5 keywords should be the best and more relevant to image as these will used for SEO. `;

  switch (title) {
    case "AdobeStock":
      prompt += `Select a relative category for the image from these options ${JSON.stringify(
        generator.categories
      )}, give id of the category in the category field. not an object`;
      break;
    case "Shutterstock":
      prompt += `
      Choose two relative categories for the image from these options ${JSON.stringify(
        generator.categories
      )}, only give the id of the categories in the category field, like this: [1, 2].`;
      break;
    case "Freepik":
      prompt += "";
      break;
    case "Vecteezy":
    case "123rf":
      prompt += "";
      break;
    case "Dreamstime":
      prompt += "";
      break;
    default:
      prompt += "Provide accurate and relevant metadata for the image. ";
  }

  prompt +=
    " Only give the response in JSON format. Add keywords in a array. Don't add any names or numbers in metadata";
  return prompt;
};

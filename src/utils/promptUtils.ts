import { Generator } from "../types";

export const generatePrompt = (
  generator: Generator,
  numKeywords: number,
  titleChars: number
): string => {
  const { title, csvRequirements } = generator;
  const requiredFields = csvRequirements.generate;

  let prompt = `You are a specialized ${title} metadata generator focused on creating high-quality, SEO-optimized JSON metadata for images.

REQUIRED OUTPUT FORMAT:
- Strictly respond with a single JSON object
- All fields must follow the exact case sensitivity provided
- No explanations or additional text outside the JSON

REQUIRED FIELDS:
${requiredFields.join(", ")}

STRICT RULES:
1. TITLE REQUIREMENTS:
   - Exact length no more no less: ${titleChars} characters
   - Must be descriptive and focus on image usage
   - No personal names or numeric values
   - Include primary subject and context

2. DESCRIPTION REQUIREMENTS (if applicable):
   - Length: 100-200 characters
   - Include: image content, potential uses, key features
   - Must be detailed and SEO-optimized
   - No repetition from title

3. KEYWORDS REQUIREMENTS:
   - Exactly ${numKeywords} unique keywords
   - Single words only, no phrases
   - No duplicates allowed
   - First 5 keywords must be highest-relevance SEO terms
   - Order by relevance (most important first)
   - No personal names or numbers

4. CATEGORIES:`;

  // Platform-specific category requirements
  switch (title) {
    case "AdobeStock":
      prompt += `\n   - Select ONE category ID from: ${JSON.stringify(
        generator.categories
      )}\n   - Provide only the numeric ID in the category field`;
      break;
    case "Shutterstock":
      prompt += `\n   - Select TWO category IDs from: ${JSON.stringify(
        generator.categories
      )}\n   - Format as array: [id1, id2]`;
      break;
    case "Freepik":
    case "Vecteezy":
    case "123rf":
    case "Dreamstime":
      prompt += "\n   - Follow platform-specific category guidelines";
      break;
    default:
      prompt += "\n   - Provide appropriate category classification";
  }

  prompt += `

ADDITIONAL REQUIREMENTS:
- Ensure all metadata is commercially relevant
- Focus on current trends and SEO optimization
- Avoid generic or overused terms
- Maintain professional language
- No placeholder or filler content

OUTPUT VALIDATION:
- Must be valid JSON format
- All required fields must be present
- All values must meet specified requirements
- Keywords must be in an array format

Return only the JSON object with no additional text or explanations.`;

  return prompt;
};

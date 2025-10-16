import { ai } from "../genkit";
import { z } from "genkit";

/**
 * AI Flow to summarize text to a maximum of 2 lines
 */
export const summarizeTextFlow = ai.defineFlow(
    {
        name: "summarizeText",
        inputSchema: z.object({
            text: z.string(),
        }),
        outputSchema: z.string(),
    },
    async (input) => {
        const { text } = input;

        // If text is already short enough, return it
        if (text.length <= 100) {
            return text;
        }

        const prompt = `Summarize the following text to fit in maximum 100 characters (about 2 short lines). Keep the essence and most important information. Be concise and direct:

Text: ${text}

Provide only the summarized text without any additional explanation, formatting, or quotation marks. Maximum 100 characters.`;

        const llmResponse = await ai.generate({
            model: "googleai/gemini-2.0-flash-exp",
            prompt,
        });

        const summary = llmResponse.text.trim();

        // Ensure it doesn't exceed 100 characters
        return summary.length > 100 ? summary.substring(0, 97) + '...' : summary;
    }
);

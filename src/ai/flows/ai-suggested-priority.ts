'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting task priorities based on the task description.
 * 
 * - suggestPriority - A function that takes a task description and returns a suggested priority level.
 * - SuggestPriorityInput - The input type for the suggestPriority function, which includes the task description.
 * - SuggestPriorityOutput - The return type for the suggestPriority function, which includes the suggested priority level.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestPriorityInputSchema = z.object({
  description: z
    .string()
    .describe('The description of the task for which to suggest a priority.'),
});

export type SuggestPriorityInput = z.infer<typeof SuggestPriorityInputSchema>;

const SuggestPriorityOutputSchema = z.object({
  priority: z
    .enum(['low', 'medium', 'high'])
    .describe('The suggested priority level for the task.'),
});

export type SuggestPriorityOutput = z.infer<typeof SuggestPriorityOutputSchema>;

export async function suggestPriority(input: SuggestPriorityInput): Promise<SuggestPriorityOutput> {
  return suggestPriorityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestPriorityPrompt',
  input: {schema: SuggestPriorityInputSchema},
  output: {schema: SuggestPriorityOutputSchema},
  prompt: `You are a task management assistant. Given the description of a task, suggest a priority level for it. The priority level should be one of "low", "medium", or "high".

Task Description: {{{description}}}

Suggest Priority:`,
});

const suggestPriorityFlow = ai.defineFlow(
  {
    name: 'suggestPriorityFlow',
    inputSchema: SuggestPriorityInputSchema,
    outputSchema: SuggestPriorityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

'use server';
/**
 * @fileOverview An AI-powered chatbot flow for responding to customer inquiries.
 *
 * - respondToInquiry - A function that handles customer inquiries and provides AI-powered responses.
 * - RespondToInquiryInput - The input type for the respondToInquiry function.
 * - RespondToInquiryOutput - The return type for the respondToInquiry function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RespondToInquiryInputSchema = z.object({
  message: z.string().describe('The customer inquiry message.'),
  chatContext: z.string().describe('The context of the conversation.'),
});
export type RespondToInquiryInput = z.infer<typeof RespondToInquiryInputSchema>;

const RespondToInquiryOutputSchema = z.object({
  response: z.string().describe('The AI-generated response to the customer inquiry.'),
});
export type RespondToInquiryOutput = z.infer<typeof RespondToInquiryOutputSchema>;

export async function respondToInquiry(input: RespondToInquiryInput): Promise<RespondToInquiryOutput> {
  return respondToInquiryFlow(input);
}

const respondToInquiryPrompt = ai.definePrompt({
  name: 'respondToInquiryPrompt',
  input: {schema: RespondToInquiryInputSchema},
  output: {schema: RespondToInquiryOutputSchema},
  prompt: `You are an AI-powered chatbot designed to respond to customer inquiries.
\nUse the following context to understand the conversation:
{{{chatContext}}}
\nRespond to the following message:
{{{message}}}
\nResponse:`, // Ensure this is valid Handlebars templating
});

const respondToInquiryFlow = ai.defineFlow(
  {
    name: 'respondToInquiryFlow',
    inputSchema: RespondToInquiryInputSchema,
    outputSchema: RespondToInquiryOutputSchema,
  },
  async input => {
    const {output} = await respondToInquiryPrompt(input);
    return output!;
  }
);

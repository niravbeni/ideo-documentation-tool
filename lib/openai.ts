import 'openai/shims/node';  // Add Node.js shim
import OpenAI from 'openai';

// Get API key with validation
const getOpenAIKey = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. Please check your .env file and ensure it contains a valid API key.'
    );
  }
  return apiKey;
};

// OpenAI client instance with error handling
let openaiInstance: OpenAI | null = null;

export const getOpenAIClient = () => {
  if (!openaiInstance) {
    try {
      openaiInstance = new OpenAI({
        apiKey: getOpenAIKey(),
      });
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error);
      throw new Error(
        `Failed to initialize OpenAI client: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  return openaiInstance;
};

// Export openai for backward compatibility
export const openai = getOpenAIClient();

// Export types that might be needed elsewhere
export type { OpenAI };

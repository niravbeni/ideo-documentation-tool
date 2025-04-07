// OpenAI configuration
export const OPENAI_CONFIG = {
  MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  TIMEOUT_MS: 120000, // 2 minute timeout (increased from 1 minute)
};

// Default vector store configuration
export const defaultVectorStore = {
  id: '',
  name: '',
  files: [],
};

// File size limits
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes 
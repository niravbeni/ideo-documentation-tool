// OpenAI configuration
export const OPENAI_CONFIG = {
  MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  TIMEOUT_MS: 60000, // 1 minute timeout
};

// Default vector store configuration
export const defaultVectorStore = {
  id: '',
  name: '',
  files: [],
};

export const DEFAULT_QUERY_TEMPLATE = `Extract the following information from the documents:
1. Client: What company or organization was the client?
2. Title: What was the title of the project?
3. Tagline: Any short phrase that captures the essence of the project
4. Challenge: What problem or challenge was addressed?
5. Design/Work: What approach was used?
6. Impact: What were the outcomes and results?

Format your response with these exact section headings:
## Client
## Title
## Tagline
## Challenge
## Design/Work
## Impact`;

// System prompt for PDF processing
export const DEVELOPER_PROMPT = `
You are a document analysis expert specializing in extracting structured information from IDEO client projects.
Your task is to extract and format information exactly as requested, following these guidelines:
- Extract only factual information from the provided content - do not invent or assume details
- Use complete sentences and clear language
- Format responses exactly as specified in the prompt
- DO NOT use ANY markdown formatting (no **, #, -, *, etc.) in your response
- Keep responses focused and concise while maintaining necessary detail
- Ensure all points are specific and actionable
`;

// File size limits
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
export const MAX_FILE_SIZE_MB = '100mb'; // 100MB as string for Next.js config 
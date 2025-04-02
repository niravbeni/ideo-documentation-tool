# IDEO Documentation Tool

A Next.js application for extracting and formatting PDF content into IDEO documentation templates.

## Features

- PDF file upload and processing
- Automatic content extraction using OpenAI
- Structured output in IDEO case study format
- Vector store integration for efficient document search
- Real-time content editing and formatting

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ideo-documentation-tool.git
cd ideo-documentation-tool
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory with your OpenAI API key:
```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4-turbo-preview  # or your preferred model
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_MODEL`: The OpenAI model to use (default: gpt-4-turbo-preview)

## Project Structure

- `/app`: Next.js application routes and components
- `/components`: Reusable React components
- `/lib`: Utility functions and configurations
- `/stores`: Global state management using Zustand

## License

MIT 
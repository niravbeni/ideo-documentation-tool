# IDEO Documentation Tool

A powerful Next.js application designed to streamline the process of extracting and formatting content from PDF documents into structured IDEO case study templates. This tool leverages OpenAI's GPT models and vector store technology to intelligently process and organize document content.

## Features

### PDF Processing
- Upload and process multiple PDF files simultaneously
- Automatic content extraction using OpenAI's GPT models
- Vector store integration for efficient document search and retrieval
- Real-time processing status updates

### Content Extraction
- Intelligent extraction of key project information:
  - Client details
  - Project title and tagline
  - Challenge description
  - Design approach and methodology
  - Project impact and outcomes
- Structured output in two formats:
  1. Project Overview Template
     - Concise project summary
     - Key deliverables
     - Project insights
  2. Inside IDEO Template
     - Detailed case study format
     - Comprehensive project narrative
     - Challenge-solution-impact structure

### User Interface
- Modern, responsive design
- Drag-and-drop file upload
- Real-time content editing capabilities
- Copy-to-clipboard functionality
- Progress indicators and status updates
- Error handling and user feedback

## Technical Architecture

### Frontend
- Built with Next.js 14 and React 18
- Styled using Tailwind CSS
- State management with Zustand
- Custom UI components built with Radix UI primitives

### Backend (API Routes)
- Vector store management for document processing
- OpenAI integration for content extraction
- PDF processing and file management
- Error handling and retry logic

### Key Technologies
- Next.js for full-stack development
- OpenAI API for content processing
- Vector store for document search
- TypeScript for type safety
- Tailwind CSS for styling
- Zustand for state management

## Setup and Installation

### Prerequisites
- Node.js 18.x or higher
- npm or yarn package manager
- OpenAI API key

### Installation Steps

1. Clone the repository:
\`\`\`bash
git clone https://github.com/[your-username]/ideo-documentation-tool.git
cd ideo-documentation-tool
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
# or
yarn install
\`\`\`

3. Create environment files:

Create a \`.env.local\` file in the root directory with the following variables:
\`\`\`env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini  # or your preferred model
\`\`\`

4. Start the development server:
\`\`\`bash
npm run dev
# or
yarn dev
\`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

1. **Upload PDFs**
   - Drag and drop PDF files onto the upload area
   - Or click to browse and select files
   - Multiple files can be uploaded simultaneously

2. **Process Documents**
   - Click "Process PDFs" to start the extraction
   - The tool will create a vector store for efficient document processing
   - Progress indicators will show the current processing status

3. **View and Edit Results**
   - Results are displayed in two formats:
     - Project Overview (summary, key points, insights)
     - Inside IDEO Template (detailed case study)
   - All sections are editable for fine-tuning
   - Use the copy button to copy content to clipboard

## API Routes

The application exposes several API endpoints:

- `/api/vector_stores/create_store`: Creates a new vector store
- `/api/vector_stores/upload_file`: Handles file uploads
- `/api/vector_stores/add_file`: Adds files to the vector store
- `/api/vector_stores/query`: Queries the vector store for content
- `/api/turn_response`: Processes GPT responses
- `/api/pdf/pages`: Handles PDF page extraction

## Error Handling

The application includes comprehensive error handling for:
- File upload issues
- PDF processing errors
- API rate limits
- Network connectivity problems
- Invalid file types
- File size limitations

## Development

### Project Structure
\`\`\`
├── app/                  # Next.js app directory
│   ├── api/             # API routes
│   ├── components/      # React components
│   └── page.tsx         # Main application page
├── lib/                 # Utility functions and configurations
├── stores/              # Zustand state management
├── components/          # Shared UI components
└── public/             # Static assets
\`\`\`

### Key Files
- `app/page.tsx`: Main application logic and UI
- `lib/assistant.ts`: OpenAI integration and processing
- `lib/constants.ts`: Configuration constants
- `stores/useToolsStore.ts`: Global state management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `OPENAI_MODEL`: The OpenAI model to use (optional, defaults to 'gpt-4o-mini')
  - Must be set before starting the application
  - Changes require server restart
  - Common values: 'gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo-preview'

Note: Environment variables are read at build/startup time. Any changes to these variables require restarting the development server or rebuilding the application. 
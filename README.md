# IDEO Documentation Tool

A powerful Next.js application designed to streamline the process of extracting and formatting content from PDF documents into structured IDEO case study templates. This tool leverages OpenAI's GPT models and vector store technology to intelligently process and organize document content.

## Overview

The IDEO Documentation Tool processes PDF documents and extracts relevant information to generate structured case studies in two formats:
1. **Project Overview** - A concise summary with key points and insights
2. **Inside IDEO Template** - A comprehensive case study with client details, challenge, design work, and impact sections

## Features

### PDF Processing
- Upload and process multiple PDF files simultaneously
- Automatic content extraction using OpenAI's GPT models
- Vector store integration for efficient document search and retrieval
- Real-time processing status updates
- Memory optimization for handling large files

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
- Drag-and-drop file upload via react-dropzone
- Real-time content editing capabilities
- Copy-to-clipboard functionality
- Progress indicators and status updates with custom IDEO loader
- Error handling and user feedback

## Technical Stack

### Frontend
- **Framework**: Next.js 15
- **UI Library**: React 18
- **Styling**: Tailwind CSS with animation plugins
- **State Management**: Zustand for global state
- **UI Components**: 
  - Custom components built with Radix UI primitives
  - Lucide React for icons
  - Recharts for data visualization (if applicable)

### Backend (API Routes)
- **Vector Store**: Integration for document processing
- **OpenAI Integration**: GPT models for content extraction
- **PDF Processing**: pdf-lib for PDF manipulation
- **Error Handling**: Comprehensive error management with retry logic

## Setup and Installation

### Prerequisites
- Node.js 18.x or higher
- npm or yarn package manager
- OpenAI API key

### Installation Steps

1. Clone the repository:
```bash
git clone https://github.com/[your-username]/ideo-documentation-tool.git
cd ideo-documentation-tool
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create environment files:

Create a `.env.local` file in the root directory with the following variables:
```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini  # or your preferred model
```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

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
- `/api/vector_stores/proxy_upload`: Optimized upload path for large files
- `/api/turn_response`: Processes GPT responses
- `/api/assistant`: Handles assistant interactions

## Error Handling

The application includes comprehensive error handling for:
- File upload issues
- PDF processing errors
- API rate limits
- Network connectivity problems
- Invalid file types
- File size limitations
- Memory optimization for large files

## Project Structure

```
├── app/                  # Next.js app directory
│   ├── api/              # API routes
│   ├── page.tsx          # Main application page
│   └── layout.tsx        # Application layout
├── lib/                  # Utility functions and configurations
│   ├── assistant.ts      # OpenAI integration and processing
│   ├── constants.ts      # Configuration constants
│   └── prompts.ts        # System prompts for AI processing
├── stores/               # Zustand state management
│   └── useToolsStore.ts  # Global state for tools
├── components/           # Shared UI components
│   ├── CaseStudyOutput.tsx  # Output display component
│   ├── FileUpload.tsx    # File upload component
│   └── ui/               # UI component library
└── public/               # Static assets
```

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `OPENAI_MODEL`: The OpenAI model to use (optional, defaults to 'gpt-4o-mini')

Note: Environment variables are read at build/startup time. Any changes to these variables require restarting the development server or rebuilding the application.

## Deployment

This application can be deployed on various hosting platforms:

### Deployment on Render

1. Fork or clone this repository to your GitHub account
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Set up the following environment variables in Render:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `OPENAI_MODEL`: Set to `gpt-4o-mini` (or your preferred model)
   - `NODE_ENV`: Set to `production`

The application will automatically deploy when you push changes to the main branch.

## Scripts

- `npm run dev`: Start the development server
- `npm run build`: Build the application for production
- `npm run start`: Start the production server
- `npm run lint`: Run ESLint to check code quality
- `npm run format`: Run Prettier to format code

## Dependencies

### Main Dependencies
- Next.js and React for the application framework
- OpenAI for AI-powered document processing
- Zustand for state management
- Radix UI for accessible UI components
- Tailwind CSS for styling
- pdf-lib for PDF manipulation
- react-dropzone for file uploads
- uuid for generating unique identifiers

### Development Dependencies
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Tailwind CSS plugins for enhanced styling
- Various TypeScript type definitions

## License

MIT License - see LICENSE file for details 
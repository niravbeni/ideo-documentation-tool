import { NextResponse } from 'next/server';
import { createErrorResponse, withRetry } from '@/lib/utils';
import { MAX_FILE_SIZE } from '@/lib/constants';

// Increase timeout for large file uploads
export const maxDuration = 180; // 3 minutes for large file uploads

// Define a safer size limit for production environments
const PRODUCTION_SAFE_LIMIT = 100 * 1024 * 1024; // 100MB (increased from 50MB)

export async function POST(request: Request) {
  console.log('Starting proxy upload process...');

  try {
    // Check if the request is multipart/form-data
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      console.error('Invalid content type:', contentType);
      const { response, status } = createErrorResponse(
        'Invalid request format',
        new Error('Request must be multipart/form-data'),
        400
      );
      return NextResponse.json(response, { status });
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('No file in request');
      const { response, status } = createErrorResponse(
        'Missing file',
        new Error('No file provided'),
        400
      );
      return NextResponse.json(response, { status });
    }

    const fileSizeMB = Math.round(file.size / (1024 * 1024) * 10) / 10;
    console.log(`Received file: ${file.name}, size: ${file.size} bytes (${fileSizeMB} MB)`);
    
    // Log file details for debugging
    console.log(`File type: ${file.type || 'not specified'}`);
    console.log(`Last modified: ${new Date(file.lastModified).toISOString()}`);

    // More strict size check for production
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && file.size > PRODUCTION_SAFE_LIMIT) {
      console.error(`File too large for production: ${file.size} bytes (${fileSizeMB} MB)`);
      const { response, status } = createErrorResponse(
        'File too large for production environment',
        new Error(`File size exceeds the ${PRODUCTION_SAFE_LIMIT / (1024 * 1024)}MB limit recommended for production deployments.`),
        413
      );
      return NextResponse.json(response, { status });
    }

    // Check absolute file size limit
    if (file.size > MAX_FILE_SIZE) {
      console.error(`File too large: ${file.size} bytes (${fileSizeMB} MB)`);
      const { response, status } = createErrorResponse(
        'File too large',
        new Error(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`),
        413
      );
      return NextResponse.json(response, { status });
    }

    // Process files chunk by chunk to avoid memory issues
    const processInSmallChunks = file.size > 20 * 1024 * 1024;
    
    if (processInSmallChunks) {
      console.log(`Large file detected. Processing ${file.name} in chunks to reduce memory usage`);
    }

    // Convert file to Blob with extra error handling
    console.log(`Converting file to ArrayBuffer...`);
    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
      console.log(`ArrayBuffer created: ${arrayBuffer.byteLength} bytes`);
    } catch (bufferError) {
      console.error('Error creating ArrayBuffer:', bufferError);
      const { response, status } = createErrorResponse(
        'Failed to process file data',
        bufferError,
        500
      );
      return NextResponse.json(response, { status });
    }
    
    let fileBlob;
    try {
      // Create blob and file with memory usage consideration
      if (processInSmallChunks) {
        // For large files, free up memory as we go
        const blobChunks = [];
        const chunkSize = 5 * 1024 * 1024; // 5MB chunks
        const totalChunks = Math.ceil(arrayBuffer.byteLength / chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, arrayBuffer.byteLength);
          const chunk = arrayBuffer.slice(start, end);
          blobChunks.push(new Blob([chunk], { type: file.type || 'application/octet-stream' }));
          
          // Log progress for very large files
          if (i % 5 === 0 || i === totalChunks - 1) {
            console.log(`Processed chunk ${i+1}/${totalChunks} of ${file.name}`);
          }
          
          // Allow GC to run between chunks
          await new Promise(r => setTimeout(r, 10));
        }
        
        const blob = new Blob(blobChunks, { type: file.type || 'application/octet-stream' });
        fileBlob = new File([blob], file.name, { type: file.type || 'application/octet-stream' });
        console.log(`Blob created from chunks: ${blob.size} bytes, type: ${blob.type}`);
      } else {
        // For smaller files, process normally
        const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });
        fileBlob = new File([blob], file.name, { type: file.type || 'application/octet-stream' });
        console.log(`Blob created: ${blob.size} bytes, type: ${blob.type}`);
      }
    } catch (blobError) {
      console.error('Error creating Blob:', blobError);
      const { response, status } = createErrorResponse(
        'Failed to create Blob from file data',
        blobError,
        500
      );
      return NextResponse.json(response, { status });
    }

    // Create a new FormData object for the OpenAI API request
    const openaiFormData = new FormData();
    openaiFormData.append('purpose', 'assistants');
    
    try {
      openaiFormData.append('file', fileBlob);
      console.log(`FormData prepared for OpenAI API with file: ${fileBlob.name}, size: ${fileBlob.size} bytes`);
    } catch (fileError) {
      console.error('Error creating File object:', fileError);
      const { response, status } = createErrorResponse(
        'Failed to prepare file for upload',
        fileError,
        500
      );
      return NextResponse.json(response, { status });
    }

    console.log(`Sending direct request to OpenAI API for file: ${file.name}`);

    // Use fetch directly to the OpenAI API with retry logic
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not available');
    }

    // Adjust timeout based on file size
    const timeoutMs = Math.min(90000, Math.max(30000, file.size / 1024)); // 30-90 seconds based on size
    
    const responseData = await withRetry(async () => {
      console.log(`Sending OpenAI API request for file: ${file.name}`);
      const openaiResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: openaiFormData,
      });

      console.log(`OpenAI API response received: ${openaiResponse.status} ${openaiResponse.statusText}`);
      
      if (!openaiResponse.ok) {
        const responseText = await openaiResponse.text();
        let errorMessage = `Failed to upload file to OpenAI: Status ${openaiResponse.status}`;

        try {
          // Try to parse as JSON, but don't fail if it's not valid JSON
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error?.message || errorMessage;
          console.error('OpenAI API error:', errorData);
        } catch {
          // If it's not valid JSON, use the raw text
          console.error('OpenAI API error (non-JSON response):', responseText);
        }

        throw new Error(errorMessage);
      }

      const responseText = await openaiResponse.text();
      console.log(`OpenAI API response text: ${responseText.substring(0, 200)}...`);
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON:', parseError);
        console.error('Raw response text:', responseText);
        throw new Error('Invalid response from OpenAI API');
      }
    }, 'upload file to OpenAI', 5, 5000, timeoutMs); // 5 retries, 5s delay, dynamic timeout

    console.log(`File uploaded successfully! File ID: ${responseData.id}`);
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Error in proxy upload:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error details: ${errorMessage}`);
    
    // Check for specific memory-related errors
    if (errorMessage.includes('memory') || 
        errorMessage.includes('heap') || 
        errorMessage.includes('Killed') ||
        errorMessage.includes('Out of memory')) {
      console.error('Server out of memory detected');
      return NextResponse.json({ 
        error: 'Server memory limit exceeded',
        message: 'The server ran out of memory while processing this file. Please try a smaller file (under 100MB).'
      }, { status: 507 }); // 507 Insufficient Storage
    }
    
    // Check for timeout errors specifically
    if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
      console.error('Upload timeout detected. The file may be too large or the server connection is slow.');
      return NextResponse.json({ 
        error: 'Upload timeout',
        message: 'The upload timed out. The file may still be processing or may be too large for the current connection.'
      }, { status: 504 }); // Gateway Timeout
    }
    
    const { response, status } = createErrorResponse('Failed to upload file', error);
    return NextResponse.json(response, { status });
  }
}

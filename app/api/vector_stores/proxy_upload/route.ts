import { NextResponse } from 'next/server';
import { createErrorResponse, withRetry } from '@/lib/utils';
import { MAX_FILE_SIZE } from '@/lib/constants';

export const maxDuration = 60; // Set max duration to 60 seconds for this route

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

    console.log(`Received file: ${file.name}, size: ${file.size} bytes (${Math.round(file.size / 1024 / 1024 * 10) / 10} MB)`);
    
    // Log file details for debugging
    console.log(`File type: ${file.type || 'not specified'}`);
    console.log(`Last modified: ${new Date(file.lastModified).toISOString()}`);

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      console.error(`File too large: ${file.size} bytes (${Math.round(file.size / 1024 / 1024 * 10) / 10} MB)`);
      const { response, status } = createErrorResponse(
        'File too large',
        new Error(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`),
        400
      );
      return NextResponse.json(response, { status });
    }

    // Convert file to Blob
    console.log(`Converting file to ArrayBuffer...`);
    const arrayBuffer = await file.arrayBuffer();
    console.log(`ArrayBuffer created: ${arrayBuffer.byteLength} bytes`);
    
    const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });
    console.log(`Blob created: ${blob.size} bytes, type: ${blob.type}`);

    // Create a new FormData object for the OpenAI API request
    const openaiFormData = new FormData();
    openaiFormData.append('purpose', 'assistants');
    const fileForUpload = new File([blob], file.name, { type: file.type || 'application/octet-stream' });
    openaiFormData.append('file', fileForUpload);
    console.log(`FormData prepared for OpenAI API with file: ${fileForUpload.name}, size: ${fileForUpload.size} bytes`);

    console.log(`Sending direct request to OpenAI API for file: ${file.name}`);

    // Use fetch directly to the OpenAI API with retry logic
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not available');
    }

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
    }, 'upload file to OpenAI', 3, 3000, 45000); // 3 retries, 3s delay, 45s timeout

    console.log(`File uploaded successfully! File ID: ${responseData.id}`);
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Error in proxy upload:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error details: ${errorMessage}`);
    
    const { response, status } = createErrorResponse('Failed to upload file', error);
    return NextResponse.json(response, { status });
  }
}

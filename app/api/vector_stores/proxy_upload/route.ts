import { NextResponse } from 'next/server';
import { createErrorResponse, withRetry } from '@/lib/utils';

// Maximum file size (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

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

    console.log(`Received file: ${file.name}, size: ${file.size} bytes`);

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      console.error(`File too large: ${file.size} bytes`);
      const { response, status } = createErrorResponse(
        'File too large',
        new Error(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`),
        400
      );
      return NextResponse.json(response, { status });
    }

    // Convert file to Blob
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });

    // Create a new FormData object for the OpenAI API request
    const openaiFormData = new FormData();
    openaiFormData.append('purpose', 'assistants');
    openaiFormData.append(
      'file',
      new File([blob], file.name, { type: file.type || 'application/octet-stream' })
    );

    console.log(`Sending direct request to OpenAI API: ${file.name}`);

    // Use fetch directly to the OpenAI API with retry logic
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not available');
    }

    const responseData = await withRetry(async () => {
      const openaiResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: openaiFormData,
      });

      if (!openaiResponse.ok) {
        const responseText = await openaiResponse.text();
        let errorMessage = 'Failed to upload file to OpenAI';

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
      try {
        return JSON.parse(responseText);
      } catch {
        console.error('Failed to parse OpenAI response as JSON');
        throw new Error('Invalid response from OpenAI API');
      }
    }, 'upload file to OpenAI');

    console.log(`File uploaded successfully! File ID: ${responseData.id}`);

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Error in proxy upload:', error);
    const { response, status } = createErrorResponse('Failed to upload file', error);
    return NextResponse.json(response, { status });
  }
}

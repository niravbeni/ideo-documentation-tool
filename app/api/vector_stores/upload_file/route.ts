import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { withRetry, createErrorResponse, base64ToBuffer } from '@/lib/utils';
import { openai } from '@/lib/openai';
import { MAX_FILE_SIZE } from '@/lib/constants';

export async function POST(request: Request) {
  console.log('Starting file upload process...');

  try {
    // Check content length header
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > MAX_FILE_SIZE) {
      const { response, status } = createErrorResponse(
        'File too large',
        new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`),
        413
      );
      return NextResponse.json(response, { status });
    }

    const { fileObject } = await request.json();

    if (!fileObject || !fileObject.name || !fileObject.content) {
      const { response, status } = createErrorResponse(
        'Invalid file data',
        new Error('File name and content are required'),
        400
      );
      return NextResponse.json(response, { status });
    }

    console.log(`Uploading file: ${fileObject.name}, size: ${fileObject.content.length} chars`);

    // Convert base64 to buffer
    const fileBuffer = base64ToBuffer(fileObject.content);
    console.log(`Converted to buffer, size: ${fileBuffer.length} bytes`);

    // Check actual file size after base64 conversion
    if (fileBuffer.length > MAX_FILE_SIZE) {
      const { response, status } = createErrorResponse(
        'File too large',
        new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`),
        413
      );
      return NextResponse.json(response, { status });
    }

    const file = await withRetry(async () => {
      // Write to temp file and use that
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, fileObject.name);

      // Write buffer to temp file
      fs.writeFileSync(tempFilePath, fileBuffer);
      console.log(`Wrote temp file to: ${tempFilePath}`);

      try {
        // Create file with OpenAI using the temp file
        const result = await openai.files.create({
          file: fs.createReadStream(tempFilePath),
          purpose: 'assistants',
        });

        return result;
      } finally {
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
      }
    }, 'upload file to OpenAI');

    console.log(`File uploaded successfully! File ID: ${file.id}`);
    return NextResponse.json(file);
  } catch (error: any) {
    console.error('Error processing upload request:', error);
    const { response, status } = createErrorResponse('Failed to upload file', error);
    return NextResponse.json(response, { status });
  }
}

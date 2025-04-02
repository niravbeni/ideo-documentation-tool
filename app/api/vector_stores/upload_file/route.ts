import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { withRetry, createErrorResponse, base64ToBuffer } from '@/lib/utils';
import { openai } from '@/lib/openai';

export async function POST(request: Request) {
  console.log('Starting file upload process...');

  try {
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

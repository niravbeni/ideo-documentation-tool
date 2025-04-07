import { NextResponse } from 'next/server';
import { withRetry, sleep, createErrorResponse } from '@/lib/utils';
import { openai } from '@/lib/openai';

type FileStatus = 'error' | 'processed' | 'processing' | 'uploaded';

export const maxDuration = 60; // Set max duration to 60 seconds for this route

export async function POST(request: Request) {
  console.log('Starting add file to vector store process...');

  try {
    const { vectorStoreId, fileId } = await request.json();

    if (!vectorStoreId || !fileId) {
      console.error('Missing required parameters:', { vectorStoreId, fileId });
      const { response, status } = createErrorResponse(
        'Missing required parameters',
        new Error('Vector store ID and file ID are required'),
        400
      );
      return NextResponse.json(response, { status });
    }

    console.log(`Adding file ${fileId} to vector store ${vectorStoreId}...`);

    // First, verify the file exists and is in 'processed' state
    try {
      const fileDetails = await withRetry(
        () => openai.files.retrieve(fileId),
        'retrieve file details',
        3, // 3 retries
        2000 // 2 second delay between retries
      );
      console.log(
        `File status check: ID: ${fileId}, Status: ${fileDetails.status}, Purpose: ${fileDetails.purpose}`
      );

      const status = fileDetails.status as FileStatus;
      if (status !== 'processed') {
        console.log(`File is not yet processed. Current status: ${status}`);

        // If the file is still processing, wait for it
        if (status === 'processing') {
          console.log('File is still processing. Waiting for it to complete...');

          // Wait for up to 20 seconds for processing to complete
          let processed = false;
          for (let i = 0; i < 10; i++) {
            await sleep(2000); // Wait 2 seconds
            const updatedFile = await openai.files.retrieve(fileId);
            const updatedStatus = updatedFile.status as FileStatus;
            console.log(`Updated file status: ${updatedStatus}`);

            if (updatedStatus === 'processed') {
              console.log('File is now processed and ready to use.');
              processed = true;
              break;
            }

            if (updatedStatus === 'error') {
              throw new Error(`File processing failed with status: ${updatedStatus}`);
            }
          }
          
          if (!processed) {
            console.log('File is still processing after waiting. Proceeding anyway...');
          }
        }
      }
    } catch (error) {
      console.error('Error verifying file status:', error);
      const { response, status } = createErrorResponse(
        'Error verifying file status',
        error,
        500
      );
      return NextResponse.json(response, { status });
    }

    // Add file to vector store with retry logic
    try {
      console.log(`Attempting to add file ${fileId} to vector store ${vectorStoreId}...`);
      const vectorStore = await withRetry(
        () => openai.vectorStores.files.create(vectorStoreId, { file_id: fileId }),
        'add file to vector store',
        3, // 3 retries
        3000 // 3 second delay between retries
      );

      console.log(`File added successfully to vector store!`);

      // Verify file was actually added by checking vector store files
      try {
        const filesInStore = await openai.vectorStores.files.list(vectorStoreId);
        const fileAdded = filesInStore.data.some((file) => file.id === fileId);

        if (fileAdded) {
          console.log(`Verified file ${fileId} is in vector store ${vectorStoreId}`);
        } else {
          console.warn(
            `File ${fileId} was apparently not added to vector store ${vectorStoreId} despite successful API call`
          );
        }
      } catch (verifyError) {
        console.warn('Could not verify file addition:', verifyError);
        // Non-fatal error, continue
      }

      return NextResponse.json(vectorStore);
    } catch (error) {
      console.error('Error adding file to vector store:', error);
      const { response, status } = createErrorResponse(
        'Failed to add file to vector store after multiple attempts',
        error,
        500
      );
      return NextResponse.json(response, { status });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    const { response, status } = createErrorResponse(
      'Error processing request',
      error,
      500
    );
    return NextResponse.json(response, { status });
  }
}

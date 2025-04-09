import { openai } from '@/lib/openai';
import { NextResponse } from 'next/server';
import { OPENAI_CONFIG } from '@/lib/constants';
import { sleep } from '@/lib/utils';

interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

interface FileStatus {
  id: string;
  status: string;
}

export async function POST(request: Request) {
  try {
    // Parse the request
    const { messages, tools, vectorStoreId } = await request.json();
    console.log('Received messages:', JSON.stringify(messages.slice(0, 1)));

    if (vectorStoreId) {
      console.log(`Using vector store ID: ${vectorStoreId}`);

      // Verify the vector store exists and wait for files to be processed
      try {
        const vectorStore = await openai.vectorStores.retrieve(vectorStoreId);
        console.log(`Vector store verified: ${vectorStore.id} (${vectorStore.name || 'unnamed'})`);

        // List files and wait for processing
        let files: FileStatus[] = [];
        let retryCount = 0;
        const MAX_RETRIES = 6; // Maximum 30 seconds of waiting (5s * 6)
        
        while (retryCount < MAX_RETRIES) {
          const filesResponse = await openai.vectorStores.files.list(vectorStoreId);
          files = filesResponse.data;
          
          // Check if any files are still processing
          const processingFiles = files.filter(file => file.status === 'in_progress');
          
          if (processingFiles.length > 0) {
            console.log(`Waiting for ${processingFiles.length} files to finish processing...`);
            retryCount++;
            if (retryCount < MAX_RETRIES) {
              await sleep(5000); // Wait 5 seconds before checking again
              continue;
            }
          }
          
          break; // Exit loop if no files are processing or we've hit max retries
        }

        console.log(`Vector store contains ${files.length} files`);
        
        // Log file information for debugging
        if (files.length > 0) {
          files.forEach((file) => {
            console.log(`File in store: ${file.id}, Status: ${file.status}`);
          });
          
          // If files are still processing after max retries, warn but continue
          const stillProcessing = files.filter(file => file.status === 'in_progress');
          if (stillProcessing.length > 0) {
            console.warn(`Proceeding with ${stillProcessing.length} files still processing after ${MAX_RETRIES} retries`);
          }
        } else {
          console.warn('Vector store has no files. File search will not work.');
        }
      } catch (error) {
        console.error('Error verifying vector store:', error);
        return NextResponse.json(
          {
            error: 'Vector store not found or inaccessible. Please try uploading your file again.',
          },
          { status: 404 }
        );
      }
    } else {
      console.warn('No vector store ID provided');
    }

    // Configure tools appropriately - add file_search if vectorStoreId is provided
    const effectiveTools = tools || [];

    if (vectorStoreId) {
      // Add file_search tool if not already present
      const hasFileSearch = effectiveTools.some((tool: Tool | string) => {
        if (typeof tool === 'string') {
          return tool === 'file_search';
        }
        return tool.type === 'file_search';
      });

      if (!hasFileSearch) {
        effectiveTools.push({
          type: 'file_search',
          vector_store_ids: [vectorStoreId],
        });
      }
    }

    // Create response
    const response = await openai.responses.create({
      model: OPENAI_CONFIG.MODEL,
      input: messages,
      tools: effectiveTools,
      stream: true,
      parallel_tool_calls: false,
    });

    // Create a ReadableStream that emits Server-Sent Events (SSE)
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let lastEventTime = Date.now();
          const STREAM_TIMEOUT = OPENAI_CONFIG.TIMEOUT_MS; // Use the same timeout as the API

          for await (const event of response) {
            // Update last event time
            lastEventTime = Date.now();
            
            // Log important events for debugging
            if (event.type.includes('file_search')) {
              console.log('File search event:', event.type);
            }

            // Send all events to the client
            const data = JSON.stringify({
              event: event.type,
              data: event,
            });
            controller.enqueue(`data: ${data}\n\n`);
            
            // Periodically check for timeout
            if (Date.now() - lastEventTime > STREAM_TIMEOUT) {
              console.error(`Stream timed out - no events received for ${STREAM_TIMEOUT/1000} seconds`);
              const timeoutError = {
                event: 'response.error',
                data: { 
                  message: `Stream timeout - no events received for ${STREAM_TIMEOUT/1000} seconds`,
                  isTimeout: true
                }
              };
              controller.enqueue(`data: ${JSON.stringify(timeoutError)}\n\n`);
              controller.enqueue(`data: [DONE]\n\n`);
              controller.close();
              return;
            }
          }

          // End of stream
          controller.enqueue(`data: [DONE]\n\n`);
          controller.close();
        } catch (error) {
          console.error('Error in streaming loop:', error);
          
          // Send error to client
          try {
            const errorEvent = {
              event: 'response.error',
              data: { 
                message: error instanceof Error ? error.message : 'Unknown error in streaming response',
                isTimeout: error instanceof Error && 
                  (error.message.includes('timeout') || error.message.includes('timed out'))
              }
            };
            controller.enqueue(`data: ${JSON.stringify(errorEvent)}\n\n`);
            controller.enqueue(`data: [DONE]\n\n`);
          } catch (e) {
            console.error('Error sending error event to client:', e);
          }
          
          controller.error(error);
        }
      },
    });

    // Return the ReadableStream as SSE
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in turn response:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}

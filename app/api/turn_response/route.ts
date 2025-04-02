import { openai } from '@/lib/openai';
import { NextResponse } from 'next/server';
import { OPENAI_CONFIG } from '@/lib/constants';

interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export async function POST(request: Request) {
  try {
    // Parse the request
    const { messages, tools, vectorStoreId } = await request.json();
    console.log('Received messages:', JSON.stringify(messages.slice(0, 1)));

    if (vectorStoreId) {
      console.log(`Using vector store ID: ${vectorStoreId}`);

      // Verify the vector store exists
      try {
        const vectorStore = await openai.vectorStores.retrieve(vectorStoreId);
        console.log(`Vector store verified: ${vectorStore.id} (${vectorStore.name || 'unnamed'})`);

        // List files in the vector store to ensure we have content
        const filesResponse = await openai.vectorStores.files.list(vectorStoreId);
        const files = filesResponse.data;
        console.log(`Vector store contains ${files.length} files`);

        // Log file information for debugging
        if (files.length > 0) {
          files.forEach((file) => {
            console.log(`File in store: ${file.id}, Status: ${file.status}`);
          });
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
          for await (const event of response) {
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
          }

          // End of stream
          controller.enqueue(`data: [DONE]\n\n`);
          controller.close();
        } catch (error) {
          console.error('Error in streaming loop:', error);
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

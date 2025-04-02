import { NextResponse } from 'next/server';
import { sleep, withRetry, createErrorResponse } from '@/lib/utils';
import { openai } from '@/lib/openai';
import { OPENAI_CONFIG } from '@/lib/constants';
import { z } from 'zod';

// Default query template for case study extraction
const DEFAULT_QUERY_TEMPLATE = `Extract the following information from the documents:
1. Client: What company or organization was the client?
2. Title: What was the title of the project?
3. Tagline: Any short phrase that captures the essence of the project
4. Challenge: What problem or challenge was addressed?
5. Design/Work: What approach was used?
6. Impact: What were the outcomes and results?

Format your response with these exact section headings:
## Client
## Title
## Tagline
## Challenge
## Design/Work
## Impact`;

// Request validation schema
const requestSchema = z.object({
  vectorStoreId: z.string().min(1, 'Vector store ID is required'),
  query: z.string().optional(),
  customPrompt: z.string().optional(),
});

// Helper function to add logs with timestamps
const createLogger = () => {
  const logs: string[] = [];
  const addLog = (message: string) => {
    const logMessage = `[${new Date().toISOString()}] ${message}`;
    console.log(logMessage);
    logs.push(logMessage);
  };
  return { logs, addLog };
};

export async function POST(request: Request) {
  const { logs, addLog } = createLogger();

  try {
    // Parse and validate the request body
    const body = await request.json();
    const result = requestSchema.safeParse(body);

    if (!result.success) {
      const { response, status } = createErrorResponse(
        'Invalid request parameters',
        new Error(result.error.message),
        400
      );
      return NextResponse.json({ ...response, logs: logs.join('\n') }, { status });
    }

    const { vectorStoreId, query, customPrompt } = result.data;

    addLog('==============================================');
    addLog(`QUERYING VECTOR STORE: ${vectorStoreId}`);
    addLog(`QUERY: ${query}`);
    if (customPrompt) {
      addLog('CUSTOM PROMPT PROVIDED');
    }
    addLog('==============================================');

    // Verify the vector store exists
    try {
      const vectorStore = await withRetry(
        () => openai.vectorStores.retrieve(vectorStoreId),
        'retrieve vector store'
      );
      addLog(`Vector store found: ${vectorStore.id} (${vectorStore.name || 'unnamed'})`);
    } catch (error) {
      addLog(`Error retrieving vector store: ${error}`);
      const { response, status } = createErrorResponse(
        'Vector store not found',
        error,
        404
      );
      return NextResponse.json({ ...response, logs: logs.join('\n') }, { status });
    }

    // Get files from the vector store
    let files;
    try {
      const filesResponse = await withRetry(
        () => openai.vectorStores.files.list(vectorStoreId),
        'list vector store files'
      );
      files = filesResponse.data;

      if (!files || files.length === 0) {
        addLog('No files found in vector store');
        const { response, status } = createErrorResponse(
          'No files found in vector store',
          new Error('Vector store is empty'),
          404
        );
        return NextResponse.json({ ...response, logs: logs.join('\n') }, { status });
      }

      addLog(`Found ${files.length} files in vector store:`);
      addLog('==============================================');
      files.forEach((file) => {
        addLog(`FILE ID: ${file.id} | STATUS: ${file.status}`);
      });
      addLog('==============================================');
    } catch (error) {
      addLog(`Error getting files from vector store: ${error}`);
      const { response, status } = createErrorResponse(
        'Failed to retrieve files from vector store',
        error,
        500
      );
      return NextResponse.json({ ...response, logs: logs.join('\n') }, { status });
    }

    // Update where effectiveQuery is used
    const effectiveQuery = query || DEFAULT_QUERY_TEMPLATE;

    try {
      // Use the Assistants API which has better file access capabilities
      addLog('Creating assistant with file access capabilities');

      // Prepare instructions - use custom prompt if provided
      const assistantInstructions = customPrompt
        ? `You are a document analysis expert skilled at extracting information from PDFs using the file_search tool.
        
Your task is to thoroughly search through files in the vector store and extract information according to this specific prompt:

${customPrompt}

Important instructions:
1. ALWAYS use the file_search tool to search through the documents
2. Try multiple search terms for each section to find all relevant information
3. Extract direct quotes and content verbatim from the documents
4. If information is truly not found after thorough searching, only then state it's not available
5. Follow the format specified in the prompt EXACTLY

The files are in vector store ID: ${vectorStoreId}
File IDs: ${files.map((file) => file.id).join(', ')}`
        : `You are a document analysis expert skilled at extracting information from PDFs using the file_search tool.
        
Your task is to thoroughly search through files in the vector store and extract specific information.

Important instructions:
1. ALWAYS use the file_search tool to search through the documents
2. Try multiple search terms for each section to find all relevant information
3. Extract direct quotes and content verbatim from the documents
4. If information is truly not found after thorough searching, only then state it's not available
5. Format your response with clear section headings as specified in the user's query

The files are in vector store ID: ${vectorStoreId}
File IDs: ${files.map((file) => file.id).join(', ')}`;

      addLog(`Assistant instructions prepared (${assistantInstructions.length} chars)`);

      // Create an assistant with file search
      const assistant = await withRetry(
        () =>
          openai.beta.assistants.create({
            name: 'Document Explorer',
            instructions: assistantInstructions,
            model: OPENAI_CONFIG.MODEL,
            tools: [{ type: 'file_search' }],
          }),
        'create assistant'
      );

      addLog(`Assistant created with ID: ${assistant.id}`);

      // Create a thread
      const thread = await withRetry(
        () => openai.beta.threads.create(),
        'create thread'
      );
      addLog(`Thread created with ID: ${thread.id}`);

      // Prepare user message
      const userMessage = customPrompt
        ? `Search through the files using the file_search tool according to the provided instructions.`
        : `Search through the files using the file_search tool and ${effectiveQuery}`;

      // Add message
      await withRetry(
        () =>
          openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: userMessage,
          }),
        'create message'
      );
      addLog(`User message added to thread: ${userMessage.substring(0, 100)}...`);

      // Run the assistant
      addLog('Running the assistant...');
      const run = await withRetry(
        () =>
          openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistant.id,
          }),
        'create run'
      );

      // Poll for completion
      let runStatus = await withRetry(
        () => openai.beta.threads.runs.retrieve(thread.id, run.id),
        'retrieve run status'
      );
      addLog(`Initial run status: ${runStatus.status}`);

      // Wait for completion with timeout
      const startTime = Date.now();

      while (
        (runStatus.status === 'queued' || runStatus.status === 'in_progress') &&
        Date.now() - startTime < OPENAI_CONFIG.TIMEOUT_MS
      ) {
        // Wait before polling again
        await sleep(1000);
        runStatus = await withRetry(
          () => openai.beta.threads.runs.retrieve(thread.id, run.id),
          'retrieve run status'
        );
        addLog(`Updated run status: ${runStatus.status}`);

        // If in progress, check run steps to see if file search is happening
        if (runStatus.status === 'in_progress') {
          try {
            const runSteps = await withRetry(
              () => openai.beta.threads.runs.steps.list(thread.id, run.id),
              'list run steps'
            );
            if (runSteps.data.length > 0) {
              // Log the latest step
              const latestStep = runSteps.data[0];
              addLog(`Latest step: ${latestStep.type} | Status: ${latestStep.status}`);

              // If it's a tool call for file_search, show details
              if (
                latestStep.step_details.type === 'tool_calls' &&
                latestStep.step_details.tool_calls.some((call) => call.type === 'file_search')
              ) {
                const fileSearchCalls = latestStep.step_details.tool_calls
                  .filter((call) => call.type === 'file_search')
                  .map((call) => call.file_search);

                fileSearchCalls.forEach((search, idx) => {
                  addLog(`File search ${idx + 1}: ${JSON.stringify(search)}`);
                });
              }
            }
          } catch (stepError) {
            // Non-critical, just log and continue
            addLog(`Error checking run steps: ${stepError}`);
          }
        }
      }

      if (runStatus.status !== 'completed') {
        addLog(`Run did not complete successfully. Final status: ${runStatus.status}`);

        // Get run steps for more details
        try {
          const runSteps = await withRetry(
            () => openai.beta.threads.runs.steps.list(thread.id, run.id),
            'list run steps'
          );
          addLog(`Run steps details: ${JSON.stringify(runSteps.data.slice(0, 3))}`);
        } catch (stepError) {
          addLog(`Failed to get run steps: ${stepError}`);
        }

        const { response, status } = createErrorResponse(
          `Assistant run failed with status: ${runStatus.status}`,
          new Error('Assistant run failed'),
          500
        );
        return NextResponse.json({ ...response, logs: logs.join('\n') }, { status });
      }

      // Get the messages (response)
      const messages = await withRetry(
        () => openai.beta.threads.messages.list(thread.id),
        'list messages'
      );

      // Log all messages
      addLog('Thread messages:');
      messages.data.forEach((msg, idx) => {
        addLog(`Message ${idx + 1} | Role: ${msg.role} | ID: ${msg.id}`);

        // For assistant messages, check if there are file_citations
        if (msg.role === 'assistant') {
          const hasFileCitations = msg.content.some(
            (content) =>
              content.type === 'text' &&
              content.text.annotations &&
              content.text.annotations.some((anno) => anno.type === 'file_citation')
          );

          addLog(`Has file citations: ${hasFileCitations}`);
        }
      });

      // Find the assistant response
      const assistantMessages = messages.data.filter((msg) => msg.role === 'assistant');

      if (assistantMessages.length === 0) {
        addLog('No assistant messages found');
        const { response, status } = createErrorResponse(
          'No response from assistant',
          new Error('No assistant messages found'),
          500
        );
        return NextResponse.json({ ...response, logs: logs.join('\n') }, { status });
      }

      // Get the latest assistant message
      const latestMessage = assistantMessages[0];

      // Extract text content
      let responseText = '';

      for (const content of latestMessage.content) {
        if (content.type === 'text') {
          responseText += content.text.value + '\n\n';
        }
      }

      addLog(`Assistant response received (${responseText.length} chars)`);
      addLog(`First 200 chars of response: ${responseText.substring(0, 200)}...`);

      // Clean up (delete assistant)
      try {
        await withRetry(
          () => openai.beta.assistants.del(assistant.id),
          'delete assistant'
        );
        addLog(`Deleted assistant ${assistant.id}`);
      } catch (cleanupError) {
        addLog('Failed to clean up assistant:');
        addLog(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
        // Non-critical error, continue
      }

      addLog('Returning response to client');
      return NextResponse.json({
        text: responseText.trim(),
        logs: logs.join('\n'),
      });
    } catch (error) {
      addLog(`Error in assistant workflow: ${error}`);
      const { response, status } = createErrorResponse(
        'Error processing request with assistant',
        error,
        500
      );
      return NextResponse.json({ ...response, logs: logs.join('\n') }, { status });
    }
  } catch (error) {
    addLog(`Error processing request: ${error}`);
    const { response, status } = createErrorResponse(
      'Error processing request',
      error,
      500
    );
    return NextResponse.json({ ...response, logs: logs.join('\n') }, { status });
  }
}

import { parse } from 'partial-json';
import { handleTool } from '@/lib/tools/tools-handling';
import useConversationStore from '@/stores/useConversationStore';
import { getTools } from './tools/tools';
// Define a simple placeholder for Annotation if the module is missing
interface Annotation {
  type: string;
  [key: string]: any;
}
import { functionsMap } from '@/config/functions';

export interface ContentItem {
  type: 'input_text' | 'output_text' | 'refusal' | 'output_audio';
  annotations?: Annotation[];
  text?: string;
}

// Message items for storing conversation history matching API shape
export interface MessageItem {
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  id?: string;
  content: ContentItem[];
}

// Custom items to display in chat
export interface ToolCallItem {
  type: 'tool_call';
  tool_type: 'file_search_call' | 'web_search_call' | 'function_call';
  status: 'in_progress' | 'completed' | 'failed' | 'searching';
  id: string;
  name?: string | null;
  call_id?: string;
  arguments?: string;
  parsedArguments?: any;
  output?: string | null;
}

export type Item = MessageItem | ToolCallItem;

export const handleTurn = async (messages: any[], tools: any[], onMessage: (data: any) => void) => {
  try {
    // Get response from the API (defined in app/api/turn_response/route.ts)
    const response = await fetch('/api/turn_response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages,
        tools: tools,
      }),
    });

    if (!response.ok) {
      console.error(`Error: ${response.status} - ${response.statusText}`);
      return;
    }

    // Reader for streaming data
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let buffer = '';

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      buffer += chunkValue;

      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') {
            done = true;
            break;
          }
          const data = JSON.parse(dataStr);
          onMessage(data);
        }
      }
    }

    // Handle any remaining data in buffer
    if (buffer && buffer.startsWith('data: ')) {
      const dataStr = buffer.slice(6);
      if (dataStr !== '[DONE]') {
        const data = JSON.parse(dataStr);
        onMessage(data);
      }
    }
  } catch (error) {
    console.error('Error handling turn:', error);
  }
};

export const processMessages = async () => {
  const { chatMessages, conversationItems, setChatMessages, setConversationItems } =
    useConversationStore.getState() as any; // Type assertion as any to bypass type checking

  const tools = getTools();
  const allConversationItems = [...conversationItems];

  let assistantMessageContent = '';
  let functionArguments = '';

  await handleTurn(allConversationItems, tools, async ({ event, data }) => {
    switch (event) {
      case 'response.output_text.delta':
      case 'response.output_text.annotation.added': {
        const { delta, item_id, annotation } = data;

        console.log('event', data);

        let partial = '';
        if (typeof delta === 'string') {
          partial = delta;
        }
        assistantMessageContent += partial;

        // If the last message isn't an assistant message, create a new one
        const lastItem = chatMessages[chatMessages.length - 1];
        if (
          !lastItem ||
          lastItem.type !== 'message' ||
          lastItem.role !== 'assistant' ||
          (lastItem.id && lastItem.id !== item_id)
        ) {
          chatMessages.push({
            type: 'message',
            role: 'assistant',
            id: item_id,
            content: [
              {
                type: 'output_text',
                text: assistantMessageContent,
              },
            ],
          } as MessageItem);
        } else {
          const contentItem = lastItem.content[0];
          if (contentItem && contentItem.type === 'output_text') {
            contentItem.text = assistantMessageContent;
            if (annotation) {
              contentItem.annotations = [...(contentItem.annotations ?? []), annotation];
            }
          }
        }

        setChatMessages([...chatMessages]);
        break;
      }

      case 'response.output_item.added': {
        const { item } = data || {};
        // New item coming in
        if (!item || !item.type) {
          break;
        }
        // Handle differently depending on the item type
        switch (item.type) {
          case 'message': {
            const text = item.content?.text || '';
            chatMessages.push({
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text,
                },
              ],
            });
            conversationItems.push({
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text,
                },
              ],
            });
            setChatMessages([...chatMessages]);
            setConversationItems([...conversationItems]);
            break;
          }
          case 'function_call': {
            functionArguments += item.arguments || '';
            chatMessages.push({
              type: 'tool_call',
              tool_type: 'function_call',
              status: 'in_progress',
              id: item.id,
              name: item.name, // function name,e.g. "get_weather"
              arguments: item.arguments || '',
              parsedArguments: {},
              output: null,
            });
            setChatMessages([...chatMessages]);
            break;
          }
          case 'web_search_call': {
            chatMessages.push({
              type: 'tool_call',
              tool_type: 'web_search_call',
              status: item.status || 'in_progress',
              id: item.id,
            });
            setChatMessages([...chatMessages]);
            break;
          }
          case 'file_search_call': {
            chatMessages.push({
              type: 'tool_call',
              tool_type: 'file_search_call',
              status: item.status || 'in_progress',
              id: item.id,
            });
            setChatMessages([...chatMessages]);
            break;
          }
        }
        break;
      }

      case 'response.output_item.done': {
        // After output item is done, adding tool call ID
        const { item } = data || {};

        const toolCallMessage = chatMessages.find((m: { id: string }) => m.id === item.id);
        if (toolCallMessage && toolCallMessage.type === 'tool_call') {
          toolCallMessage.call_id = item.call_id;
          setChatMessages([...chatMessages]);
        }
        conversationItems.push(item);
        setConversationItems([...conversationItems]);
      }

      case 'response.function_call_arguments.delta': {
        // Streaming arguments delta to show in the chat
        functionArguments += data.delta || '';
        let parsedFunctionArguments = {};
        if (functionArguments.length > 0) {
          parsedFunctionArguments = parse(functionArguments);
        }

        const toolCallMessage = chatMessages.find((m: { id: string }) => m.id === data.item_id);
        if (toolCallMessage && toolCallMessage.type === 'tool_call') {
          toolCallMessage.arguments = functionArguments;
          try {
            toolCallMessage.parsedArguments = parsedFunctionArguments;
          } catch {
            // partial JSON can fail parse; ignore
          }
          setChatMessages([...chatMessages]);
        }
        break;
      }

      case 'response.function_call_arguments.done': {
        // This has the full final arguments string
        const { item_id, arguments: finalArgs } = data;

        functionArguments = finalArgs;

        // Mark the tool_call as "completed" and parse the final JSON
        const toolCallMessage = chatMessages.find((m: { id: string }) => m.id === item_id);
        if (toolCallMessage && toolCallMessage.type === 'tool_call') {
          toolCallMessage.arguments = finalArgs;
          toolCallMessage.parsedArguments = parse(finalArgs);
          toolCallMessage.status = 'completed';
          setChatMessages([...chatMessages]);

          // Handle tool call (execute function)
          const toolResult = await handleTool(
            toolCallMessage.name as keyof typeof functionsMap,
            toolCallMessage.parsedArguments
          );

          // Record tool output
          toolCallMessage.output = JSON.stringify(toolResult);
          setChatMessages([...chatMessages]);
          conversationItems.push({
            type: 'function_call_output',
            call_id: toolCallMessage.call_id,
            status: 'completed',
            output: JSON.stringify(toolResult),
          });
          setConversationItems([...conversationItems]);

          // Create another turn after tool output has been added
          await processMessages();
        }
        break;
      }

      case 'response.web_search_call.completed': {
        const { item_id, output } = data;
        const toolCallMessage = chatMessages.find((m: { id: string }) => m.id === item_id);
        if (toolCallMessage && toolCallMessage.type === 'tool_call') {
          toolCallMessage.output = output;
          toolCallMessage.status = 'completed';
          setChatMessages([...chatMessages]);
        }
        break;
      }

      case 'response.file_search_call.completed': {
        const { item_id, output } = data;
        const toolCallMessage = chatMessages.find((m: { id: string }) => m.id === item_id);
        if (toolCallMessage && toolCallMessage.type === 'tool_call') {
          toolCallMessage.output = output;
          toolCallMessage.status = 'completed';
          setChatMessages([...chatMessages]);
        }
        break;
      }

      // Handle other events as needed
    }
  });
};

/**
 * Gets a response from the assistant for case study extraction
 */
export async function getAssistantResponse(
  content: string,
  vectorStoreId?: string,
  systemPrompt: string = 'You are a document analysis expert. Extract structured information from the files in the vector store as instructed.'
): Promise<string> {
  try {
    if (!vectorStoreId) {
      console.error('No vector store ID provided to getAssistantResponse');
      return 'Error: No vector store connected. Please upload a file first.';
    }

    console.log(`Getting assistant response with vector store ID: ${vectorStoreId}`);

    // Add instructions for handling large documents
    const enhancedPrompt = `${systemPrompt}

When working with documents:
1. Search thoroughly for SPECIFIC EXAMPLES, DIRECT QUOTES, and UNIQUE LANGUAGE
2. Look in multiple sections of the document, not just summaries
3. Use direct quotes when describing processes, methodologies, and outcomes
4. Extract exact phrasing and terminology rather than paraphrasing
5. Prioritize sections that contain detailed information about methods, results and client feedback
6. FOCUS ON THE DESIGN/WORK SECTION - This should be the most detailed with specific methodologies
7. For the Challenge section, focus on the core issues rather than listing all challenges
8. Balance the content across sections - don't make any one section overwhelm the others`;

    // Call the turn_response API with the structured prompts
    const response = await fetch('/api/turn_response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: enhancedPrompt,
          },
          {
            role: 'user',
            content: content,
          },
        ],
        // Tools will be added automatically by the API
        vectorStoreId: vectorStoreId,
      }),
    });

    if (!response.ok) {
      let errorText = `Error from API: ${response.status}`;
      try {
        const errorData = await response.json();
        errorText = errorData.error || errorText;
      } catch {
        // Ignore parse errors
      }
      console.error(errorText);
      throw new Error(errorText);
    }

    console.log('Response received, processing stream...');

    // Parse the streaming response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;

      if (done) break;

      const chunk = decoder.decode(value);
      buffer += chunk;

      // Process complete SSE events in the buffer
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);

          if (dataStr === '[DONE]') {
            done = true;
            break;
          }

          try {
            const data = JSON.parse(dataStr);

            // Extract text from output_text delta events
            if (data.event === 'response.output_text.delta' && data.data.delta) {
              fullText += data.data.delta;
            }

            // Log file search events to help with debugging
            if (data.event?.includes('file_search')) {
              console.log(
                'File search event:',
                data.event,
                JSON.stringify(data.data).substring(0, 200)
              );
            }
          } catch (e) {
            console.error('Error parsing data:', e);
          }
        }
      }
    }

    const result = fullText.trim();

    // Log a preview of the result
    if (result) {
      console.log(
        `Assistant response received (${result.length} chars). Preview: ${result.substring(0, 100)}...`
      );
    } else {
      console.warn('No content received from assistant');
    }

    return (
      result || 'No content was generated. There may be an issue with accessing the uploaded files.'
    );
  } catch (error) {
    console.error('Error getting assistant response:', error);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

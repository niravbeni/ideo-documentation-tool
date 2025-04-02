import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { createErrorResponse } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      const { response, status } = createErrorResponse(
        'Messages array is required',
        new Error('Missing or invalid messages array'),
        400
      );
      return NextResponse.json(response, { status });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      stream: true,
    });

    // Convert the OpenAI stream to a Web API ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        controller.enqueue('data: [DONE]\n\n');
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in assistant route:', error);
    const { response, status } = createErrorResponse(
      'Failed to process assistant request',
      error,
      500
    );
    return NextResponse.json(response, { status });
  }
}

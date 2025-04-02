import { NextResponse } from 'next/server';
import { withRetry, createErrorResponse } from '@/lib/utils';
import { openai } from '@/lib/openai';

export async function POST(request: Request) {
  console.log('Starting vector store creation process...');

  try {
    const { storeName } = await request.json();
    const name = storeName || 'IDEO Documentation Store';

    console.log(`Creating vector store with name: ${name}...`);

    const vectorStore = await withRetry(async () => {
      const store = await openai.vectorStores.create({
        name: name,
      });

      // Log the vector store ID prominently for debugging
      console.log('==============================================');
      console.log(`VECTOR STORE CREATED - ID: ${store.id}`);
      console.log(`NAME: ${store.name}`);
      console.log('==============================================');

      return store;
    }, 'create vector store');

    return NextResponse.json({
      id: vectorStore.id,
      name: vectorStore.name,
    });
  } catch (error: any) {
    console.error('Error processing request:', error);
    const { response, status } = createErrorResponse('Failed to create vector store', error);
    return NextResponse.json(response, { status });
  }
}

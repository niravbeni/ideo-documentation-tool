import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { createErrorResponse } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vectorStoreId = searchParams.get('vectorStoreId');

    if (!vectorStoreId) {
      const { response, status } = createErrorResponse(
        'Vector store ID is required',
        new Error('Missing required parameter: vectorStoreId'),
        400
      );
      return NextResponse.json(response, { status });
    }

    const response = await openai.vectorStores.files.list(vectorStoreId);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error listing vector store files:', error);
    const { response, status } = createErrorResponse(
      'Failed to list vector store files',
      error,
      500
    );
    return NextResponse.json(response, { status });
  }
}

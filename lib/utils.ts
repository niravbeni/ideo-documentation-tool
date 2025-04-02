import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Retry configuration
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 2000;

// Helper function to wait
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Convert base64 to buffer
export const base64ToBuffer = (base64: string): Buffer => {
  try {
    return Buffer.from(base64, 'base64');
  } catch (error) {
    throw new Error(`Failed to convert base64 to buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Standard error response format
export interface ErrorResponse {
  message: string;
  error: string;
  code?: string;
  details?: unknown;
}

export const createErrorResponse = (
  message: string,
  error: Error | unknown,
  status: number = 500,
  includeDetails: boolean = process.env.NODE_ENV === 'development'
): { response: ErrorResponse; status: number } => {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  const response: ErrorResponse = {
    message,
    error: errorObj.message || 'Unknown error',
    code: 'code' in errorObj ? (errorObj as { code?: string }).code : undefined,
  };

  if (includeDetails) {
    response.details = errorObj.toString();
  }

  return { response, status };
};

// Retry logic with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} for ${operationName}...`);
      return await operation();
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Attempt ${attempt} failed: ${errorMessage}`);

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  const finalError = lastError instanceof Error ? lastError : new Error(String(lastError));
  console.error(`All attempts for ${operationName} failed:`, finalError);
  throw finalError;
}

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
  initialDelay: number = RETRY_DELAY_MS,
  timeoutMs: number = 30000 // 30 second timeout by default
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} for ${operationName}...`);
      
      // Add timeout to the operation
      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error(`Operation '${operationName}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      
      // Race between the operation and the timeout
      const result = await Promise.race([operation(), timeoutPromise]);
      console.log(`${operationName} succeeded on attempt ${attempt}`);
      return result as T;
    } catch (error) {
      lastError = error;
      
      // Extract and format error message for better logging
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
        // Log stack trace for debugging
        if (error.stack) {
          console.error(`Error stack: ${error.stack}`);
        }
      } else if (typeof error === 'object' && error !== null) {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = String(error);
        }
      } else {
        errorMessage = String(error);
      }
      
      console.error(`Attempt ${attempt} failed for ${operationName}: ${errorMessage}`);

      // Check if we should retry
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Retrying ${operationName} in ${delay}ms...`);
        await sleep(delay);
      } else {
        console.error(`All ${maxRetries} attempts for ${operationName} failed.`);
      }
    }
  }

  // Format the final error message
  let errorMessage = 'Operation failed after multiple attempts';
  if (lastError instanceof Error) {
    errorMessage = `${operationName} failed: ${lastError.message}`;
  } else if (typeof lastError === 'object' && lastError !== null) {
    try {
      errorMessage = `${operationName} failed: ${JSON.stringify(lastError)}`;
    } catch {
      errorMessage = `${operationName} failed: ${String(lastError)}`;
    }
  }
  
  const finalError = new Error(errorMessage);
  if (lastError instanceof Error && lastError.stack) {
    finalError.stack = lastError.stack;
  }
  
  console.error(`Final error for ${operationName}:`, finalError);
  throw finalError;
}

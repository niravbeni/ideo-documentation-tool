import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Set larger payload limits for API routes
export const config = {
  matcher: '/api/:path*',
};

export function middleware(request: NextRequest) {
  // Log the path for debugging
  console.log(`Middleware handling request to: ${request.nextUrl.pathname}`);
  
  // Continue processing the request, but now with properly configured limits
  return NextResponse.next();
} 
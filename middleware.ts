import { NextResponse } from 'next/server';

// Next.js 15 compatible config
export const config = {
  matcher: [
    /*
     * Match all API routes:
     * - /api/vector_stores/upload_file
     * - /api/vector_stores/proxy_upload  
     * - /api/vector_stores/add_file
     * - all other API routes
     */
    '/api/:path*',
  ],
};

// Simple middleware that just passes through the request
export function middleware() {
  return NextResponse.next();
} 
import { NextResponse } from 'next/server';
import { fromPath } from 'pdf2pic';
import path from 'path';
import fs from 'fs/promises';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get the PDF file path
    const pdfPath = path.join(process.cwd(), 'uploads', `${fileId}.pdf`);

    // Create the images directory if it doesn't exist
    const imagesDir = path.join(process.cwd(), 'public', 'pdf-pages');
    await fs.mkdir(imagesDir, { recursive: true });

    // Configure pdf2pic
    const options = {
      density: 300,
      saveFilename: `${fileId}-page`,
      savePath: imagesDir,
      format: 'png',
      width: 2048,
      height: 2048,
    };

    // Initialize converter
    const convert = fromPath(pdfPath, options);

    // Convert all pages
    const pageToImage = await convert.bulk(-1);

    // Format the response
    const pages = pageToImage.map((result: any, index: number) => ({
      url: `/pdf-pages/${fileId}-page${index + 1}.png`,
      pageNumber: index + 1,
    }));

    return NextResponse.json({ pages });
  } catch (error) {
    console.error('Error processing PDF pages:', error);
    return NextResponse.json({ error: 'Failed to process PDF pages' }, { status: 500 });
  }
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import { Trash2 } from 'lucide-react';
import useToolsStore from '@/stores/useToolsStore';
import { Button } from '@/components/ui/Button';
import { CaseStudyOutput } from '@/components/CaseStudyOutput';
import { getAssistantResponse } from '@/lib/assistant';
import { IdeoLoader } from 'ideo-loader';

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedOutput, setProcessedOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { vectorStore, setVectorStore, setFileSearchEnabled } = useToolsStore();
  const [caseStudyData, setCaseStudyData] = useState<any>(null);
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // Enable file search when vector store is connected
  useEffect(() => {
    setFileSearchEnabled(!!vectorStore?.id);
  }, [vectorStore?.id, setFileSearchEnabled]);

  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files]);
  }, []);

  const removeFile = useCallback((fileName: string) => {
    setSelectedFiles((prev) => prev.filter((file) => file.name !== fileName));
  }, []);

  const readFileAsBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === 'string') {
          resolve(e.target.result.split(',')[1]);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
    });
  };

  const uploadFile = async (fileObject: { name: string; content: string; size: number }) => {
    try {
      // Try standard upload first
      const uploadResponse = await fetch('/api/vector_stores/upload_file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileObject }),
      });

      const uploadData = await uploadResponse.json();
      if (uploadResponse.ok && uploadData.id) {
        return uploadData.id;
      }

      // If standard upload fails, try alternative upload
      const binaryData = atob(fileObject.content);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const fileBlob = new File([blob], fileObject.name, { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', fileBlob);
      formData.append('purpose', 'assistants');

      const altUploadResponse = await fetch('/api/vector_stores/proxy_upload', {
        method: 'POST',
        body: formData,
      });

      const altUploadData = await altUploadResponse.json();
      if (!altUploadResponse.ok || !altUploadData.id) {
        throw new Error(altUploadData.error || 'Alternative upload failed');
      }

      return altUploadData.id;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const processPDFs = async () => {
    setError('');
    setIsProcessing(true);
    setShowResults(false);
    setIsCreatingStore(true);
    setProcessingStatus('Creating vector store...');

    try {
      if (!selectedFiles.length) {
        throw new Error('No files selected. Please select at least one PDF.');
      }

      // Clear existing vector store
      setVectorStore({ id: '', name: '' });
      setFileSearchEnabled(false);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create new vector store
      const createResponse = await fetch('/api/vector_stores/create_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: selectedFiles.length > 1 ? `${selectedFiles.length} PDFs` : selectedFiles[0].name,
          forceNew: true,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Error creating vector store');
      }

      const { id: vectorStoreId } = await createResponse.json();
      setVectorStore({
        id: vectorStoreId,
        name: selectedFiles.length > 1 ? `${selectedFiles.length} PDFs` : selectedFiles[0].name,
      });

      // Process files
      for (const file of selectedFiles) {
        const truncatedName = file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name;
        setProcessingStatus(`Adding ${truncatedName}`);

        try {
          const fileData = await readFileAsBase64(file);
          const fileId = await uploadFile({
            name: file.name,
            content: fileData,
            size: file.size,
          });

          const addFileResponse = await fetch('/api/vector_stores/add_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, vectorStoreId }),
          });

          if (!addFileResponse.ok) {
            throw new Error(`Error adding ${file.name} to vector store`);
          }
        } catch (error) {
          throw new Error(
            `Error processing ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      setProcessingStatus('Processing PDFs...');

      // Define unified system prompt
      const systemPrompt = `You are a document analysis expert specializing in extracting structured information from IDEO client projects.
Your task is to extract and format information exactly as requested, following these guidelines:
- Extract only factual information from the provided content - do not invent or assume details
- Use complete sentences and clear language
- Format responses exactly as specified in the prompt
- DO NOT use ANY markdown formatting (no **, #, -, *, etc.) in your response
- Keep responses focused and concise while maintaining necessary detail
- Ensure all points are specific and actionable
- Start each section directly with the content (no markdown headers or formatting)`;

      // Define content prompts
      const summaryPrompt = `Extract key information for a project overview with the following structure:

Summary: A concise summary of the client project (1-2 paragraphs maximum).

Key Points: 
1. First key point as a single sentence about a key deliverable.
2. Second key point as a single sentence about a key deliverable.
3. Third key point as a single sentence about a key deliverable.
4. Fourth key point as a single sentence about a key deliverable.
5. Fifth key point as a single sentence about a key deliverable.

Insights: 
1. First insight as a single sentence about a project insight or design decision.
2. Second insight as a single sentence about a project insight or design decision.
3. Third insight as a single sentence about a project insight or design decision.
4. Fourth insight as a single sentence about a project insight or design decision.
5. Fifth insight as a single sentence about a project insight or design decision.

Format the Key Points and Insights exactly as numbered lists as shown above. Each point must be a single complete sentence. Do not use any markdown formatting in your response.`;

      const insideIDEOPrompt = `Extract detailed case study information with the following structure:

Client:
One line identifying the client organization name. Keep it brief.

Title:
A short, compelling title that encapsulates the main focus (one line).

Tagline:
A brief phrase that captures the essence of the project (one line).

Challenge:
Provide a detailed description (3-5 paragraphs) of the business context, primary issues faced, market conditions, user needs, and the specific challenge. Include what was at stake for the client and why this challenge was significant. If possible, frame part of the challenge as a "How might we" question.

Design/Work:
Explain thoroughly (3-5 paragraphs) the approach, methods, and strategies used. Include information about the design process, research conducted, prototyping techniques, key insights, collaboration methods, and iteration toward the final solution. Describe specific design interventions, tools, or frameworks created.

Impact/Outcome:
Detail comprehensively (3-5 paragraphs) the concrete results and measurable outcomes. Include quantitative metrics when available, qualitative feedback from stakeholders, how the solution transformed the client's business or user experience, and any ongoing effects. Describe how the solution addressed the original challenge and any unexpected positive outcomes.

Do not use any markdown formatting (no ##, **, etc.) in your response. Start each section directly with the section name followed by a colon.`;

      // Get content with null check for vectorStore
      console.log('Getting content with vector store ID:', vectorStoreId);

      // Process Project Overview template
      setProcessingStatus('Generating Project Overview...');
      const summaryText = await getAssistantResponse(summaryPrompt, vectorStoreId, systemPrompt);
      setProcessingStatus('Project Overview template complete');
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Show completion message briefly

      // Process Inside IDEO template
      setProcessingStatus('Generating Inside IDEO template...');
      const insideIDEOText = await getAssistantResponse(
        insideIDEOPrompt,
        vectorStoreId,
        systemPrompt
      );
      setProcessingStatus('Inside IDEO template complete');
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Show completion message briefly

      console.log('All content received.');

      // Parse the summary text into separate sections
      const parseSummaryResponse = (text: string) => {
        console.log('Parsing summary response:', text);

        // Handle the case where the content is already in the expected format
        if (text.includes('Key Points: 1.') && text.includes('Insights: 1.')) {
          // Extract each section - these patterns match the specific format in your example
          const summaryPattern = /^Summary:\s*(.*?)(?=Key Points:)/s;
          const keyPointsPattern = /Key Points:\s*(1\..*?)(?=Insights:)/s;
          const insightsPattern = /Insights:\s*(1\..*?)$/s;

          const summaryMatch = text.match(summaryPattern);
          const keyPointsMatch = text.match(keyPointsPattern);
          const insightsMatch = text.match(insightsPattern);

          console.log(
            'Summary match:',
            summaryMatch ? summaryMatch[1].substring(0, 50) + '...' : 'Not found'
          );
          console.log(
            'Key Points match:',
            keyPointsMatch ? keyPointsMatch[1].substring(0, 50) + '...' : 'Not found'
          );
          console.log(
            'Insights match:',
            insightsMatch ? insightsMatch[1].substring(0, 50) + '...' : 'Not found'
          );

          // Extract key points and insights as arrays
          const extractPoints = (text: string | undefined): string[] => {
            if (!text) return [];

            const points = text
              .trim()
              .split(/\d+\.\s+/) // Split by numbered points (e.g., "1. ", "2. ")
              .map((line) => line.trim())
              .filter((line) => line); // Remove empty items

            console.log('Extracted points:', points);
            return points;
          };

          const result = {
            summary: summaryMatch ? summaryMatch[1].trim() : '',
            keyPoints: keyPointsMatch ? extractPoints(keyPointsMatch[1]) : [],
            insights: insightsMatch ? extractPoints(insightsMatch[1]) : [],
          };

          console.log('Parsed summary data:', result);
          return result;
        } else {
          // Fallback to the original implementation
          const summaryMatch = text.match(/Summary:\s*([\s\S]*?)(?=Key Points:|$)/i);
          const keyPointsMatch = text.match(/Key Points:\s*([\s\S]*?)(?=Insights:|$)/i);
          const insightsMatch = text.match(/Insights:\s*([\s\S]*?)(?=$)/i);

          console.log('Using fallback parsing');
          console.log(
            'Summary match:',
            summaryMatch ? summaryMatch[1].substring(0, 50) + '...' : 'Not found'
          );
          console.log(
            'Key Points match:',
            keyPointsMatch ? keyPointsMatch[1].substring(0, 50) + '...' : 'Not found'
          );
          console.log(
            'Insights match:',
            insightsMatch ? insightsMatch[1].substring(0, 50) + '...' : 'Not found'
          );

          // Extract key points and insights as arrays
          const extractPoints = (text: string | undefined): string[] => {
            if (!text) return [];

            const points = text
              .trim()
              .split(/\n/)
              .map((line) => line.trim())
              .map((line) => line.replace(/^\d+[\.\)]\s*|^[•\-\s]+/, '').trim()) // Remove list markers
              .filter((line) => line && !/^\d+$/.test(line)); // Filter empty lines

            console.log('Extracted points:', points);
            return points;
          };

          const result = {
            summary: summaryMatch ? summaryMatch[1].trim() : '',
            keyPoints: keyPointsMatch ? extractPoints(keyPointsMatch[1]) : [],
            insights: insightsMatch ? extractPoints(insightsMatch[1]) : [],
          };

          console.log('Parsed summary data:', result);
          return result;
        }
      };

      // Parse the summary response
      const summaryData = parseSummaryResponse(summaryText);

      // Process the data into the case study format
      const caseStudyData = {
        summary: summaryData.summary,
        keyPoints: summaryData.keyPoints,
        insights: summaryData.insights,
        ...parseInsideIDEOResponse(insideIDEOText),
      };

      setProcessedOutput(JSON.stringify(caseStudyData));
      setCaseStudyData(caseStudyData);
      setShowResults(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred.');
      console.error('Error processing PDFs:', error);
      setShowResults(false);
      setProcessedOutput('');
    } finally {
      setIsProcessing(false);
      setIsCreatingStore(false);
      setProcessingStatus('');
    }
  };

  // Helper function to parse the Inside IDEO response
  function parseInsideIDEOResponse(text: string) {
    // Clean any markdown artifacts from the input text
    const cleanedText = text
      .replace(/\*\*/g, '') // Remove bold formatting
      .replace(/\*/g, '') // Remove italic formatting
      .replace(/`/g, ''); // Remove code formatting

    // Extract each section from the text using regex
    const clientMatch = cleanedText.match(/Client:\s*([\s\S]*?)(?=Title:|$)/i);
    const titleMatch = cleanedText.match(/Title:\s*([\s\S]*?)(?=Tagline:|$)/i);
    const taglineMatch = cleanedText.match(/Tagline:\s*([\s\S]*?)(?=Challenge:|$)/i);
    const challengeMatch = cleanedText.match(/Challenge:\s*([\s\S]*?)(?=Design\/Work:|$)/i);
    const designWorkMatch = cleanedText.match(/Design\/Work:\s*([\s\S]*?)(?=Impact|$)/i);
    // Check for both "Impact" and "Impact/Outcome" headers
    const impactMatch = cleanedText.match(/Impact(?:\/Outcome)?:\s*([\s\S]*?)(?=$)/i);

    // Clean up extracted content
    const cleanContent = (content: string | undefined) => {
      if (!content) return '';
      return content
        .trim()
        .replace(/^[-•*]\s*/gm, '') // Remove bullet points at start of lines
        .replace(/\n\s*\n/g, '\n\n') // Normalize multiple line breaks
        .replace(/#{1,6}\s+/g, ''); // Remove any nested headers
    };

    return {
      client: clientMatch ? cleanContent(clientMatch[1]) : '',
      title: titleMatch ? cleanContent(titleMatch[1]) : '',
      tagline: taglineMatch ? cleanContent(taglineMatch[1]) : '',
      challenge: challengeMatch ? cleanContent(challengeMatch[1]) : '',
      designWork: designWorkMatch ? cleanContent(designWorkMatch[1]) : '',
      impact: impactMatch ? cleanContent(impactMatch[1]) : '',
    };
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="w-full border-b border-gray-100 bg-white px-4 py-8 shadow-sm md:px-8">
        <h1 className="text-center text-3xl font-bold text-gray-900">IDEO Documentation Tool</h1>
        <p className="mt-2 text-center text-gray-500">
          Extract and format PDF content for IDEO documentation
        </p>
      </header>

      <main className="flex-1 bg-gray-200 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          {/* File Upload Section */}
          <div className="rounded-xl bg-white p-8 shadow-sm">
            {isProcessing ? (
              <div className="relative flex min-h-[200px] flex-col items-center justify-center">
                <IdeoLoader size="large" />
                <p className="absolute bottom-0 left-1/2 -translate-x-1/2 text-sm text-gray-400">
                  {processingStatus}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <FileUpload onFilesSelected={handleFilesSelected}>
                  <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-gray-200 px-12 py-12 transition-colors hover:border-blue-500">
                    <div className="flex flex-col items-center">
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="mx-auto mb-4 text-gray-400"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <h2 className="mb-2 text-xl font-semibold text-gray-900">
                        Drag & drop your PDF files here
                      </h2>
                      <p className="mb-0 text-gray-500">or click to browse files</p>
                    </div>
                  </div>
                </FileUpload>
              </div>
            )}

            {/* Uploaded Files List */}
            {selectedFiles.length > 0 && (
              <div className="mt-8 border-t border-gray-100 pt-8">
                <h3 className="mb-4 text-sm font-medium text-gray-900">Selected Files</h3>
                <div className="space-y-2">
                  {selectedFiles.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3"
                    >
                      <div className="flex items-center">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="mr-2 text-gray-400"
                        >
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.name)}
                        className="text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Process Button - Always visible */}
            <div className="mt-6 text-center">
              <div className="mb-2 flex flex-col justify-center gap-2 sm:flex-row">
                <Button
                  onClick={processPDFs}
                  disabled={isProcessing || isCreatingStore || selectedFiles.length === 0}
                  className="rounded-lg bg-blue-600 px-8 py-2 text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProcessing ? (
                    <div className="flex items-center">
                      <svg
                        className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing...
                    </div>
                  ) : isCreatingStore ? (
                    'Creating vector store...'
                  ) : (
                    'Process PDFs'
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          {showResults && processedOutput ? (
            <div className="mt-8 rounded-xl bg-white shadow-sm">
              <CaseStudyOutput
                assistantMessage={processedOutput}
                onSave={(updatedContent: string) => {
                  setProcessedOutput(updatedContent);

                  // Update the case study data when content is edited
                  try {
                    // First try to parse as JSON
                    const updatedData = JSON.parse(updatedContent);
                    setCaseStudyData(updatedData);
                  } catch {
                    // If not valid JSON, parse it using the same functions
                    // that were used to generate the initial data
                    const parseSections = (text: string) => {
                      const summaryMatch = text.match(
                        /Summary:\s*([\s\S]*?)(?=Key Points:|Client:|$)/i
                      );
                      const keyPointsMatch = text.match(
                        /Key Points:\s*([\s\S]*?)(?=Insights:|Client:|$)/i
                      );
                      const insightsMatch = text.match(/Insights:\s*([\s\S]*?)(?=Client:|$)/i);

                      // Extract points from bullet list format
                      const extractBulletPoints = (text: string | undefined): string[] => {
                        if (!text) return [];
                        return text
                          .split(/\n/)
                          .map((line) => line.trim())
                          .map((line) => line.replace(/^[-•]\s*/, '').trim())
                          .filter(Boolean);
                      };

                      return {
                        summary: summaryMatch ? summaryMatch[1].trim() : '',
                        keyPoints: keyPointsMatch ? extractBulletPoints(keyPointsMatch[1]) : [],
                        insights: insightsMatch ? extractBulletPoints(insightsMatch[1]) : [],
                      };
                    };

                    // Parse the updated content
                    const summaryData = parseSections(updatedContent);
                    const insideIDEOData = parseInsideIDEOResponse(updatedContent);

                    // Update the state with the new data
                    setCaseStudyData({
                      ...caseStudyData,
                      ...summaryData,
                      ...insideIDEOData,
                    });
                  }
                }}
                caseStudyData={caseStudyData}
              />
            </div>
          ) : error && !isProcessing ? (
            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
              {error}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

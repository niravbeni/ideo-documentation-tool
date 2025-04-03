import React, { useState, useEffect, useRef } from 'react';
import { EditableField } from './ui/EditableField';
import { EditableArrayField } from './ui/EditableArrayField';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';

interface CaseStudyOutputProps {
  assistantMessage: string;
  onSave?: (updatedContent: string) => void;
  caseStudyData?: {
    summary?: string;
    keyPoints?: string[];
    insights?: string[];
    client?: string;
    title?: string;
    tagline?: string;
    challenge?: string;
    designWork?: string;
    impact?: string;
  };
}

interface ParsedContent {
  summary?: string;
  keyPoints?: string[];
  insights?: string[];
  client?: string;
  title?: string;
  tagline?: string;
  challenge?: string;
  designWork?: string;
  impact?: string;
}

export function CaseStudyOutput({ assistantMessage, onSave, caseStudyData }: CaseStudyOutputProps) {
  const [content, setContent] = useState<ParsedContent>({});
  const [initialContent, setInitialContent] = useState<ParsedContent>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const initialLoadRef = useRef(true);

  // Parse the assistant message into structured content
  const parseContent = (message: string): ParsedContent => {
    console.log('Parsing message:', message);

    if (!message) {
      console.log('Empty message received');
      setParseError('No content to display');
      return {};
    }

    // Check if the message is an error or request for more information
    if (
      !message.includes('Summary:') &&
      !message.includes('Key Points:') &&
      !message.includes('Client:')
    ) {
      setParseError(
        'The AI response is not in the expected format. Please try processing the PDFs again.'
      );
      return {};
    }

    setParseError(null);

    try {
      // First check if it's valid JSON
      let jsonContent = {};
      try {
        jsonContent = JSON.parse(message);
        if (typeof jsonContent === 'object' && jsonContent !== null) {
          return jsonContent as ParsedContent;
        }
      } catch {
        // Not valid JSON, proceed with text parsing
      }

      // Split by section headers
      const sections = message
        .split(
          /\n\n(?=Summary:|Key Points:|Insights:|Client:|Title:|Tagline:|Challenge:|Design\/Work:|Impact:|Impact\/Outcome:)/
        )
        .filter(Boolean);
      console.log('Parsed sections:', sections);

      const parsedContent: ParsedContent = {};

      sections.forEach((section) => {
        const trimmedSection = section.trim();
        console.log('Processing section:', trimmedSection);

        // Extract section header and content
        const headerMatch = trimmedSection.match(
          /^(Summary|Key Points|Insights|Client|Title|Tagline|Challenge|Design\/Work|Impact|Impact\/Outcome):\s*([\s\S]*)/
        );

        if (headerMatch) {
          const [, header, content] = headerMatch;
          const cleanContent = content.trim();

          switch (header) {
            case 'Summary':
              parsedContent.summary = cleanContent;
              break;
            case 'Key Points':
              // Process numbered points, ensuring each item is properly extracted
              parsedContent.keyPoints = cleanContent
                .split(/\n/)
                .map((point) => point.trim())
                // Remove numbers, bullets, or any other markers at the beginning
                .map((point) => point.replace(/^\d+[\.\)]\s*|^[•\-\s]+/, '').trim())
                // Filter out empty lines or lines that are just numbers
                .filter((point) => point && !/^\d+$/.test(point));
              break;
            case 'Insights':
              parsedContent.insights = cleanContent
                .split(/\n/)
                .map((insight) => insight.trim())
                // Remove numbers, bullets, or any other markers at the beginning
                .map((insight) => insight.replace(/^\d+[\.\)]\s*|^[•\-\s]+/, '').trim())
                // Filter out empty lines or lines that are just numbers
                .filter((insight) => insight && !/^\d+$/.test(insight));
              break;
            case 'Client':
              parsedContent.client = cleanContent;
              break;
            case 'Title':
              parsedContent.title = cleanContent;
              break;
            case 'Tagline':
              parsedContent.tagline = cleanContent;
              break;
            case 'Challenge':
              parsedContent.challenge = cleanContent;
              break;
            case 'Design/Work':
              parsedContent.designWork = cleanContent;
              break;
            case 'Impact':
            case 'Impact/Outcome':
              parsedContent.impact = cleanContent;
              break;
          }
        }
      });

      // Validate that we parsed at least some content
      if (Object.keys(parsedContent).length === 0) {
        setParseError('Could not parse any content from the AI response');
        return {};
      }

      console.log('Parsed content:', parsedContent);
      return parsedContent;
    } catch (error) {
      console.error('Error parsing content:', error);
      setParseError('Error parsing the AI response');
      return {};
    }
  };

  // Convert content back to string format
  const contentToString = (content: ParsedContent): string => {
    // First try to convert to JSON
    try {
      return JSON.stringify(content);
    } catch {
      // Fallback to string format if JSON conversion fails
      const sections: string[] = [];

      if (content.summary) {
        sections.push(`Summary:\n${content.summary}`);
      }

      if (content.keyPoints?.length) {
        sections.push(`Key Points:\n${content.keyPoints.map((point) => `- ${point}`).join('\n')}`);
      }

      if (content.insights?.length) {
        sections.push(`Insights:\n${content.insights.map((insight) => `- ${insight}`).join('\n')}`);
      }

      if (content.client) {
        sections.push(`Client:\n${content.client}`);
      }

      if (content.title) {
        sections.push(`Title:\n${content.title}`);
      }

      if (content.tagline) {
        sections.push(`Tagline:\n${content.tagline}`);
      }

      if (content.challenge) {
        sections.push(`Challenge:\n${content.challenge}`);
      }

      if (content.designWork) {
        sections.push(`Design/Work:\n${content.designWork}`);
      }

      if (content.impact) {
        sections.push(`Impact/Outcome:\n${content.impact}`);
      }

      return sections.join('\n\n');
    }
  };

  // Initialize content from either assistantMessage or caseStudyData
  useEffect(() => {
    if (caseStudyData) {
      // If caseStudyData is provided, use that directly
      const parsedFromData: ParsedContent = {
        summary: caseStudyData.summary || '',
        keyPoints: caseStudyData.keyPoints || [],
        insights: caseStudyData.insights || [],
        client: caseStudyData.client || '',
        title: caseStudyData.title || '',
        tagline: caseStudyData.tagline || '',
        challenge: caseStudyData.challenge || '',
        designWork: caseStudyData.designWork || '',
        impact: caseStudyData.impact || '',
      };

      // Set the current editable content
      setContent(parsedFromData);

      // Store the original AI response values only on initial load
      if (initialLoadRef.current) {
        console.log('Storing initial AI response values');
        setInitialContent({ ...parsedFromData });
        initialLoadRef.current = false;
      }

      setParseError(null);
    } else if (assistantMessage) {
      // Otherwise parse from the assistantMessage as before
      console.log('Assistant message received:', assistantMessage);
      const parsed = parseContent(assistantMessage);
      console.log('Setting content to:', parsed);

      // Set the current editable content
      setContent(parsed);

      // Store the original AI response values only on initial load
      if (initialLoadRef.current) {
        console.log('Storing initial AI response values');
        setInitialContent({ ...parsed });
        initialLoadRef.current = false;
      }
    }
  }, [assistantMessage, caseStudyData]);

  const handleFieldChange = (
    field: keyof ParsedContent,
    rawValue: string,
    processedValue: string | string[]
  ) => {
    console.log(`Changing field ${field}:`, processedValue);

    // Update the content state
    const updatedContent = {
      ...content,
      [field]: processedValue,
    };
    setContent(updatedContent);

    if (onSave) {
      const contentString = contentToString(updatedContent);
      console.log('Saving updated content:', contentString.substring(0, 50) + '...');
      onSave(contentString);
    }
  };

  // Handle reset for a single field
  const handleReset = (field: keyof ParsedContent) => {
    const updatedContent = {
      ...content,
      [field]: initialContent[field],
    };
    setContent(updatedContent);

    if (onSave) {
      onSave(contentToString(updatedContent));
    }
  };

  return (
    <div className="w-full">
      {parseError ? (
        <div className="text-red-500 p-4 rounded bg-red-50 mb-4">{parseError}</div>
      ) : (
        <div className="p-8">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-8 w-full grid grid-cols-2">
              <TabsTrigger value="overview" className="flex-1">Project Overview</TabsTrigger>
              <TabsTrigger value="insideideo" className="flex-1">Inside IDEO Template</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              <div className="space-y-6">
                <EditableField
                  fieldId="summary"
                  label="Summary"
                  value={content.summary || ''}
                  rawValue={content.summary || ''}
                  onChange={(rawValue, processedValue) => handleFieldChange('summary', rawValue, processedValue)}
                  onReset={() => handleReset('summary')}
                  isExpanded={true}
                />

                <EditableArrayField
                  fieldId="keyPoints"
                  label="Key Points"
                  value={content.keyPoints || []}
                  rawValue={content.keyPoints?.join('\n') || ''}
                  onChange={(rawValue, processedArray) => handleFieldChange('keyPoints', rawValue, processedArray)}
                  onReset={() => handleReset('keyPoints')}
                />

                <EditableArrayField
                  fieldId="insights"
                  label="Insights"
                  value={content.insights || []}
                  rawValue={content.insights?.join('\n') || ''}
                  onChange={(rawValue, processedArray) => handleFieldChange('insights', rawValue, processedArray)}
                  onReset={() => handleReset('insights')}
                />
              </div>
            </TabsContent>

            <TabsContent value="insideideo" className="mt-0">
              <div className="space-y-6">
                <EditableField
                  fieldId="client"
                  label="Client"
                  value={content.client || ''}
                  rawValue={content.client || ''}
                  onChange={(rawValue, processedValue) => handleFieldChange('client', rawValue, processedValue)}
                  onReset={() => handleReset('client')}
                />

                <EditableField
                  fieldId="title"
                  label="Title"
                  value={content.title || ''}
                  rawValue={content.title || ''}
                  onChange={(rawValue, processedValue) => handleFieldChange('title', rawValue, processedValue)}
                  onReset={() => handleReset('title')}
                />

                <EditableField
                  fieldId="tagline"
                  label="Tagline"
                  value={content.tagline || ''}
                  rawValue={content.tagline || ''}
                  onChange={(rawValue, processedValue) => handleFieldChange('tagline', rawValue, processedValue)}
                  onReset={() => handleReset('tagline')}
                />

                <EditableField
                  fieldId="challenge"
                  label="Challenge"
                  value={content.challenge || ''}
                  rawValue={content.challenge || ''}
                  onChange={(rawValue, processedValue) => handleFieldChange('challenge', rawValue, processedValue)}
                  onReset={() => handleReset('challenge')}
                  isExpanded={true}
                />

                <EditableField
                  fieldId="designWork"
                  label="Design/Work"
                  value={content.designWork || ''}
                  rawValue={content.designWork || ''}
                  onChange={(rawValue, processedValue) => handleFieldChange('designWork', rawValue, processedValue)}
                  onReset={() => handleReset('designWork')}
                  isExpanded={true}
                />

                <EditableField
                  fieldId="impact"
                  label="Impact/Outcome"
                  value={content.impact || ''}
                  rawValue={content.impact || ''}
                  onChange={(rawValue, processedValue) => handleFieldChange('impact', rawValue, processedValue)}
                  onReset={() => handleReset('impact')}
                  isExpanded={true}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

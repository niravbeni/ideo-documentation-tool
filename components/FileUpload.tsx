'use client';
import React, { useCallback, useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  children?: React.ReactNode;
}

interface ValidationResult {
  valid: boolean;
  error: string;
  files?: File[];
}

export default function FileUpload({ onFilesSelected, children }: FileUploadProps) {
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: string }>({});
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit
  const MAX_FILES = 5; // Maximum number of files

  const acceptedFileTypes = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
  };

  // Clear success message on unmount or when new files are selected
  useEffect(() => {
    return () => {
      setIsSuccess(false);
    };
  }, []);

  const validateFiles = useCallback((files: File[]): ValidationResult => {
    if (files.length > MAX_FILES) {
      return {
        valid: false,
        error: `Maximum ${MAX_FILES} files allowed at once`,
      };
    }

    const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      return {
        valid: false,
        error: `File${oversizedFiles.length > 1 ? 's' : ''} exceed${
          oversizedFiles.length === 1 ? 's' : ''
        } size limit (${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB)`,
      };
    }

    return {
      valid: true,
      error: '',
      files,
    };
  }, [MAX_FILE_SIZE]);

  const handleUploadFiles = useCallback(
    async (selectedFiles: File[]) => {
      if (!selectedFiles.length) return;

      const validation = validateFiles(selectedFiles);
      if (!validation.valid) {
        setUploadProgress((prev) => ({
          ...prev,
          general: validation.error,
        }));
        return;
      }

      setUploading(true);
      try {
        onFilesSelected(selectedFiles);
        setIsSuccess(true);

        // Clear progress messages after 5 seconds
        setTimeout(() => {
          setUploadProgress({});
        }, 5000);

        // Clear success message after 3 seconds
        setTimeout(() => {
          setIsSuccess(false);
        }, 3000);
      } catch (error) {
        console.error('Error handling files:', error);
        setUploadProgress((prev) => ({
          ...prev,
          general: `Error: ${error instanceof Error ? error.message : 'Unknown error handling files'}`,
        }));
      } finally {
        setUploading(false);
      }
    },
    [onFilesSelected, validateFiles]
  );

  const { getRootProps, getInputProps } = useDropzone({
    accept: acceptedFileTypes,
    multiple: true,
    maxFiles: MAX_FILES,
    onDrop: handleUploadFiles,
  });

  return (
    <div>
      <div {...getRootProps()} className="cursor-pointer transition-colors">
        <input {...getInputProps()} />
        {children}
        {uploading && (
          <div className="space-y-2">
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div
                key={fileName}
                className={`text-sm ${progress.startsWith('Error:') ? 'text-red-600' : 'text-gray-600'}`}
              >
                {progress}
              </div>
            ))}
          </div>
        )}
      </div>

      {isSuccess && (
        <div className="mt-4 flex items-center rounded-lg bg-green-50 p-3 text-sm text-green-600">
          <Check className="mr-2 h-4 w-4" />
          Files selected successfully!
        </div>
      )}
    </div>
  );
}

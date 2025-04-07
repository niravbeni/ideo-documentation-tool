'use client';
import React, { useCallback, useState, useEffect } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { MAX_FILE_SIZE } from '../lib/constants';

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
  const [isWarning, setIsWarning] = useState<boolean>(false);
  const MAX_FILES = 5; // Maximum number of files
  const MAX_RECOMMENDED_SIZE = 100 * 1024 * 1024; // 100MB recommended maximum

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
      setIsWarning(false);
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

    // Check for large files (over recommended size but under absolute max)
    const largeFiles = files.filter(
      (file) => file.size > MAX_RECOMMENDED_SIZE && file.size <= MAX_FILE_SIZE
    );
    
    if (largeFiles.length > 0) {
      setIsWarning(true);
      setUploadProgress({
        general: `Warning: Large file${largeFiles.length > 1 ? 's' : ''} detected. Files over 100MB may cause server timeouts.`,
      });
      // Still return valid but with a warning
      return {
        valid: true,
        error: '',
        files,
      };
    }

    return {
      valid: true,
      error: '',
      files,
    };
  }, [MAX_RECOMMENDED_SIZE]);

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

        // Clear progress messages after 10 seconds for warnings, 5 seconds for success
        setTimeout(() => {
          setUploadProgress({});
        }, isWarning ? 10000 : 5000);

        // Clear success message after 3 seconds
        setTimeout(() => {
          setIsSuccess(false);
        }, 3000);
        
        // Keep warnings visible longer
        if (isWarning) {
          setTimeout(() => {
            setIsWarning(false);
          }, 8000);
        }
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
    [onFilesSelected, validateFiles, isWarning]
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
                className={`text-sm ${progress.startsWith('Error:') ? 'text-red-600' : 
                  progress.startsWith('Warning:') ? 'text-amber-600' : 'text-gray-600'}`}
              >
                {progress.startsWith('Warning:') && (
                  <AlertTriangle className="mr-2 inline-block h-4 w-4 text-amber-600" />
                )}
                {progress}
              </div>
            ))}
          </div>
        )}
      </div>

      {isWarning && !isSuccess && (
        <div className="mt-4 flex items-center rounded-lg bg-amber-50 p-3 text-sm text-amber-600">
          <AlertTriangle className="mr-2 h-4 w-4" />
          Large files detected! Files over 100MB may timeout or fail on some servers.
        </div>
      )}

      {isSuccess && (
        <div className="mt-4 flex items-center rounded-lg bg-green-50 p-3 text-sm text-green-600">
          <Check className="mr-2 h-4 w-4" />
          Files selected successfully!
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-500">
        Recommended maximum file size: 100MB. Absolute maximum: 100MB.
      </div>
    </div>
  );
}

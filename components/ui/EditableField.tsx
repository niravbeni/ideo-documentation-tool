import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { CopyButton } from './CopyButton';
import { RotateCcw, Check } from 'lucide-react';

interface EditableFieldProps {
  fieldId: string;
  label: string;
  value: string;
  rawValue: string;
  rows?: number;
  placeholder?: string;
  onFocus?: (fieldId: string) => void;
  onBlur?: () => void;
  onChange: (rawValue: string, processedValue: string) => void;
  onReset?: () => void;
}

export function EditableField({
  fieldId,
  label,
  value,
  rawValue,
  rows = 1,
  placeholder,
  onFocus,
  onBlur,
  onChange,
  onReset,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [editedValue, setEditedValue] = useState(rawValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync editedValue with rawValue when it changes from props
  useEffect(() => {
    setEditedValue(rawValue);
  }, [rawValue]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    setIsFocused(false);
    // Trim only trailing and leading whitespace but preserve internal formatting
    const trimmedValue = editedValue.replace(/^\s+|\s+$/g, '');
    onChange(trimmedValue, trimmedValue);
    if (onBlur) onBlur();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsFocused(false);
    setEditedValue(rawValue);
    if (onBlur) onBlur();
  };

  const handleReset = () => {
    if (onReset) onReset();
    if (isEditing) {
      setIsEditing(false);
      setIsFocused(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && rows === 1) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
    setIsFocused(true);
    if (editedValue !== value) {
      setEditedValue(value);
    }
    if (onFocus) onFocus(fieldId);
  };

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="flex space-x-2">
        <div
          className={`flex-1 rounded-md border transition-all duration-150 ${!isEditing ? 'cursor-text hover:border-primary' : ''} ${
            isFocused || isEditing ? 'border-primary shadow-sm' : 'bg-background'
          }`}
          onClick={() => {
            if (!isEditing) {
              handleFocus();
            }
          }}
        >
          {isEditing ? (
            <Textarea
              id={fieldId}
              value={editedValue}
              onChange={(e) => {
                // Preserve line breaks but prevent accidental leading/trailing whitespace
                const newValue = e.target.value;
                setEditedValue(newValue);
              }}
              rows={rows}
              placeholder={placeholder}
              className="h-full w-full resize-none p-3"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              ref={textareaRef}
            />
          ) : (
            <div className="whitespace-pre-wrap p-3 text-sm">
              {value || <span className="italic text-muted-foreground">{placeholder}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col space-y-1 self-start">
          {isEditing ? (
            <Button
              variant="outline"
              size="sm"
              className="px-2"
              onClick={handleSave}
              title="Done editing"
            >
              <Check className="h-4 w-4" />
            </Button>
          ) : (
            <CopyButton text={value} size="sm" />
          )}
          <Button
            variant="outline"
            size="sm"
            className="px-2"
            onClick={handleReset}
            title="Reset this field"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import Input from './Input';
import { RotateCcw, Check, Plus, X } from 'lucide-react';
import { CopyButton } from './CopyButton';

interface EditableArrayFieldProps {
  fieldId: string;
  label: string;
  value: string[];
  rawValue: string;
  onChange: (rawValue: string, processedArray: string[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onReset?: () => void;
}

export function EditableArrayField({
  fieldId,
  label,
  value,
  rawValue,
  onChange,
  onFocus,
  onBlur,
  onReset,
}: EditableArrayFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [editItems, setEditItems] = useState<string[]>(value);

  // Reset edit items when value changes
  useEffect(() => {
    setEditItems(value);
  }, [value]);

  const handleItemChange = (index: number, newValue: string) => {
    const updatedItems = [...editItems];
    updatedItems[index] = newValue;
    setEditItems(updatedItems);

    const newRawValue = updatedItems.join('\n');
    const filteredItems = updatedItems.filter((item) => item.trim() !== '');
    onChange(newRawValue, filteredItems);
  };

  const handleAddItem = () => {
    setEditItems([...editItems, '']);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...editItems];
    updatedItems.splice(index, 1);

    if (updatedItems.length === 0) {
      updatedItems.push('');
    }

    setEditItems(updatedItems);

    const newRawValue = updatedItems.join('\n');
    const filteredItems = updatedItems.filter((item) => item.trim() !== '');
    onChange(newRawValue, filteredItems);
  };

  const handleFocus = () => {
    setIsEditing(true);
    onFocus?.();
  };

  const handleSaveChanges = () => {
    setIsEditing(false);
    onBlur?.();

    // Filter out empty items and trim whitespace
    const cleanedItems = editItems.map((item) => item.trim()).filter((item) => item !== '');

    if (onChange) {
      onChange(cleanedItems.join('\n'), cleanedItems);
    }
  };

  const handleReset = () => {
    if (onReset) onReset();
    if (isEditing) {
      setIsEditing(false);
      setIsFocused(false);
    }
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
          } group relative`}
          onClick={() => {
            if (!isEditing) {
              handleFocus();
            }
          }}
        >
          {isEditing ? (
            <div className="space-y-1 p-3">
              {editItems.map((item, index) => (
                <div key={index} className="group/item flex items-center gap-2">
                  <div className="text-muted-foreground">•</div>
                  <Input
                    value={item}
                    onChange={(e) => handleItemChange(index, e.target.value)}
                    className="flex-1 border-0 bg-transparent p-0 text-sm focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="Enter item text"
                    autoFocus={index === editItems.length - 1 && item === ''}
                    onFocus={() => setIsFocused(true)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 transition-opacity group-hover/item:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(index);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddItem();
                }}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Item
              </Button>
            </div>
          ) : (
            <div className="p-3">
              <ul className="space-y-0.5 text-sm">
                {value.map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="text-muted-foreground">•</div>
                    <span>{item}</span>
                  </li>
                ))}
                {value.length === 0 && (
                  <li className="flex items-center gap-2 italic text-muted-foreground">
                    <div>•</div>
                    <span>Click to add items</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
        <div className="flex flex-col space-y-1 self-start">
          {isEditing ? (
            <Button
              variant="outline"
              size="sm"
              className="px-2"
              onClick={handleSaveChanges}
              title="Done editing"
            >
              <Check className="h-4 w-4" />
            </Button>
          ) : (
            <CopyButton text={rawValue} size="sm" />
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

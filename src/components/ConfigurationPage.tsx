import { useState, useEffect } from 'react';
import { TextAttributes } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import type { ParsedKey } from '@opentui/core';
import { Effect } from 'effect';
import { ENV_CREDENTIALS, writeEnvFile, type MissingCredential } from '../config/env-config';

interface ConfigurationPageProps {
  missingCredentials: MissingCredential[];
  onClose: () => void;
  onSave: () => void;
}

export default function ConfigurationPage({ missingCredentials, onClose, onSave }: ConfigurationPageProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    missingCredentials.forEach(cred => {
      initial[cred.key] = cred.currentValue || '';
    });
    return initial;
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSave = async () => {
    setSaveStatus('saving');
    setErrorMessage('');

    try {
      // Filter out empty values
      const updates: Record<string, string> = {};
      for (const [key, value] of Object.entries(values)) {
        if (value && value.trim() !== '') {
          updates[key] = value;
        }
      }

      await Effect.runPromise(writeEnvFile(updates));
      setSaveStatus('success');

      // Close after a brief success message
      setTimeout(() => {
        onSave();
      }, 1000);
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save configuration');
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    const credential = missingCredentials[index];
    if (credential) {
      setInputValue(values[credential.key] || '');
    }
  };

  const finishEditing = () => {
    if (editingIndex !== null) {
      const credential = missingCredentials[editingIndex];
      if (credential) {
        setValues(prev => ({ ...prev, [credential.key]: inputValue }));
      }
    }
    setEditingIndex(null);
    setInputValue('');
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setInputValue('');
  };

  useKeyboard((key: ParsedKey) => {
    if (editingIndex !== null) {
      // Editing mode
      if (key.name === 'escape') {
        cancelEditing();
      } else if (key.name === 'return') {
        finishEditing();
      } else if (key.name === 'backspace') {
        setInputValue(prev => prev.slice(0, -1));
      } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setInputValue(prev => prev + key.sequence);
      }
    } else {
      // Navigation mode
      if (key.name === 'escape') {
        handleSkip();
      } else if (key.name === 'up' || key.name === 'k') {
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (key.name === 'down' || key.name === 'j') {
        setSelectedIndex(prev => Math.min(missingCredentials.length, prev + 1));
      } else if (key.name === 'return' || key.name === 'e') {
        if (selectedIndex < missingCredentials.length) {
          startEditing(selectedIndex);
        } else {
          // Save button
          handleSave();
        }
      } else if (key.name === 's') {
        handleSave();
      } else if (key.name === 'q') {
        handleSkip();
      }
    }
  });

  const getSaveButtonLabel = () => {
    switch (saveStatus) {
      case 'saving': return 'Saving...';
      case 'success': return 'Saved!';
      case 'error': return 'Error - Try Again';
      default: return 'Save Configuration';
    }
  };

  const getSaveButtonColor = () => {
    switch (saveStatus) {
      case 'success': return '#50fa7b';
      case 'error': return '#ff5555';
      default: return '#f1fa8c';
    }
  };

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#282a36',
        zIndex: 2000,
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <box
        style={{
          padding: 1,
          border: true,
          borderColor: '#6272a4',
        }}
      >
        <text
          style={{
            fg: '#50fa7b',
            attributes: TextAttributes.BOLD,
          }}
          wrapMode="none"
        >
          ⚙️  Configuration Setup
        </text>
      </box>

      {/* Description */}
      <box style={{ padding: 1, border: true, borderColor: '#6272a4' }}>
        <text style={{ fg: '#f8f8f2' }} wrapMode="word">
          Welcome! Some credentials are missing or incomplete. Please configure them below to use all features of Lazygitlab.
        </text>
      </box>

      {/* Credentials List */}
      <box style={{ flexDirection: 'column', padding: 1, flexGrow: 1, overflow: 'hidden' }}>
        {missingCredentials.map((credential, index) => {
          const isSelected = selectedIndex === index && editingIndex === null;
          const isEditing = editingIndex === index;
          const currentValue = values[credential.key] || '';
          const displayValue = isEditing ? inputValue : currentValue;
          const isEmpty = !currentValue || currentValue.trim() === '';

          return (
            <box
              key={credential.key}
              style={{
                flexDirection: 'column',
                marginBottom: 1,
                padding: 1,
                border: true,
                borderColor: isSelected || isEditing ? '#50fa7b' : '#6272a4',
                backgroundColor: isSelected || isEditing ? '#44475a' : 'transparent',
              }}
            >
              {/* Credential Name */}
              <box style={{ marginBottom: 0 }}>
                <text
                  style={{
                    fg: isEmpty ? '#ff79c6' : '#8be9fd',
                    attributes: TextAttributes.BOLD,
                  }}
                  wrapMode="none"
                >
                  {credential.displayName} {isEmpty ? '(Required)' : '✓'}
                </text>
              </box>

              {/* Description */}
              <box style={{ marginBottom: 0 }}>
                <text style={{ fg: '#6272a4' }} wrapMode="word">
                  {credential.description}
                </text>
              </box>

              {/* Help URL */}
              {credential.helpUrl && (
                <box style={{ marginBottom: 0 }}>
                  <text style={{ fg: '#bd93f9' }} wrapMode="none">
                    Get token: {credential.helpUrl}
                  </text>
                </box>
              )}

              {/* Input Field */}
              <box style={{ marginTop: 0, flexDirection: 'row' }}>
                <text style={{ fg: '#f8f8f2' }} wrapMode="none">
                  {credential.key}={' '}
                </text>
                <text
                  style={{
                    fg: isEditing ? '#f1fa8c' : isEmpty ? '#6272a4' : '#50fa7b',
                    attributes: isEditing ? TextAttributes.UNDERLINE : TextAttributes.NONE,
                  }}
                  wrapMode="none"
                >
                  {displayValue || credential.placeholder}
                  {isEditing ? '█' : ''}
                </text>
              </box>

              {/* Edit hint */}
              {isSelected && !isEditing && (
                <box>
                  <text style={{ fg: '#6272a4', attributes: TextAttributes.ITALIC }} wrapMode="none">
                    Press Enter or 'e' to edit
                  </text>
                </box>
              )}
            </box>
          );
        })}

        {/* Save Button */}
        <box
          style={{
            marginTop: 1,
            padding: 1,
            border: true,
            borderColor: selectedIndex === missingCredentials.length ? '#50fa7b' : '#6272a4',
            backgroundColor: selectedIndex === missingCredentials.length ? '#44475a' : 'transparent',
          }}
        >
          <text
            style={{
              fg: getSaveButtonColor(),
              attributes: TextAttributes.BOLD,
            }}
            wrapMode="none"
          >
            {getSaveButtonLabel()}
          </text>
        </box>

        {errorMessage && (
          <box style={{ marginTop: 1, padding: 1, border: true, borderColor: '#ff5555' }}>
            <text style={{ fg: '#ff5555' }} wrapMode="word">
              Error: {errorMessage}
            </text>
          </box>
        )}
      </box>

      {/* Footer with instructions */}
      <box
        style={{
          padding: 1,
          border: true,
          borderColor: '#6272a4',
          flexDirection: 'column',
        }}
      >
        {editingIndex !== null ? (
          <text style={{ fg: '#6272a4' }} wrapMode="none">
            Type to enter value • Enter: Save • Esc: Cancel
          </text>
        ) : (
          <>
            <text style={{ fg: '#6272a4' }} wrapMode="none">
              ↑/↓ or j/k: Navigate • Enter or e: Edit • s: Save • q or Esc: Skip
            </text>
            <text style={{ fg: '#6272a4' }} wrapMode="none">
              You can skip this and configure credentials later in .env file
            </text>
          </>
        )}
      </box>
    </box>
  );
}

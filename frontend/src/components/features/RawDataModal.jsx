import React from 'react';
import { XMarkIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

const RawDataModal = ({ isOpen, onClose, data, title = 'Raw JSON Data' }) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  // Parse and format JSON for display
  let jsonString;
  let parseError = null;
  let formattedJson = null;
  
  try {
    if (typeof data === 'string') {
      // If it's a string, try to parse it first to validate and reformat
      const parsed = JSON.parse(data);
      jsonString = JSON.stringify(parsed, null, 2);
      formattedJson = parsed;
    } else {
      // If it's already an object, stringify with formatting
      jsonString = JSON.stringify(data, null, 2);
      formattedJson = data;
    }
  } catch (error) {
    // If parsing fails, just display as-is
    jsonString = typeof data === 'string' ? data : String(data);
    parseError = error.message;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Syntax highlight JSON
  const syntaxHighlight = (json) => {
    if (!json) return '';
    
    json = JSON.stringify(json, null, 2);
    
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'text-yellow-400'; // numbers
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-blue-300'; // keys
            return `<span class="${cls}">${match}</span>`;
          } else {
            cls = 'text-green-300'; // strings
            return `<span class="${cls}">${match}</span>`;
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-purple-400'; // booleans
        } else if (/null/.test(match)) {
          cls = 'text-red-400'; // null
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Raw JSON payload data
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content - Scrollable JSON */}
          <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-900">
            {parseError && (
              <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-md">
                <p className="text-sm text-yellow-300">
                  ⚠️ Warning: Could not parse as JSON. Displaying raw content.
                </p>
                <p className="text-xs text-yellow-400 mt-1">{parseError}</p>
              </div>
            )}
            {parseError ? (
              // Display raw content without syntax highlighting
              <pre className="text-sm text-gray-100 font-mono leading-relaxed whitespace-pre overflow-x-auto">
                <code className="language-json block">{jsonString}</code>
              </pre>
            ) : (
              // Display with syntax highlighting
              <pre 
                className="text-sm font-mono leading-relaxed whitespace-pre overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(formattedJson) }}
              />
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex justify-between items-center border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {!parseError && (
                <>
                  <span className="mr-3">
                    📊 {jsonString.split('\n').length} lines
                  </span>
                  <span>
                    💾 {(new Blob([jsonString]).size / 1024).toFixed(2)} KB
                  </span>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RawDataModal;


# Provisioning Monitor - Payload Viewer Feature

## Overview
Added a raw JSON payload viewer column to the Provisioning Monitor page, allowing users to view the complete payload data for each provisioning request in a formatted, syntax-highlighted modal.

## Implementation Date
January 14, 2026

## Features

### 1. Payload Column
- New "Payload" column added to the Provisioning Monitor table
- Displays a clickable `{} JSON` badge for requests that have payload data
- Shows an em-dash (—) for requests without payload data
- Consistent styling with amber/gold color theme

### 2. Raw Data Modal
- Opens when clicking the JSON badge
- Displays the raw `Payload_Data__c` field from the Salesforce record
- Features:
  - **Syntax Highlighting**: JSON keys, values, strings, numbers, booleans, and nulls are color-coded
  - **Copy to Clipboard**: One-click button to copy the entire JSON content
  - **Download as File**: Save the JSON content as a `.json` file to your downloads folder
  - **Line Count & Size**: Shows the number of lines and file size in KB
  - **Error Handling**: Gracefully displays content even if JSON parsing fails
  - **Dark Theme**: Consistent with the application's dark mode

### 3. User Experience
- Modal title includes the Technical Team Request name for context
- Scrollable content area for large payloads
- Close button in header and footer
- Click outside modal to close

## Technical Implementation

### Component Updates

#### `ProvisioningRequests.jsx`
**Location**: `frontend/src/pages/ProvisioningRequests.jsx`

**Changes**:
1. Imported `RawDataModal` component
2. Added `rawDataModal` state for modal visibility and data
3. Added `handleViewPayload` function to open the modal
4. Added `closeRawDataModal` function to close the modal
5. Added new table column header for "Payload"
6. Added table cell rendering with clickable JSON badge
7. Updated colspan for empty state row (11 → 12)
8. Rendered `RawDataModal` component at end of JSX

**State Structure**:
```javascript
const [rawDataModal, setRawDataModal] = useState({
  isOpen: false,
  data: null,
  title: '',
});
```

**Handler Functions**:
```javascript
const handleViewPayload = (request) => {
  if (!request.Payload_Data__c) {
    return;
  }
  setRawDataModal({
    isOpen: true,
    data: request.Payload_Data__c,
    title: `Payload Data - ${request.Name}`,
  });
};

const closeRawDataModal = () => {
  setRawDataModal({
    isOpen: false,
    data: null,
    title: '',
  });
};
```

### Reused Component

#### `RawDataModal.jsx`
**Location**: `frontend/src/components/features/RawDataModal.jsx`

This existing component (also used on Current Accounts page) provides:
- JSON parsing and formatting
- Syntax highlighting with color-coded tokens
- Copy to clipboard functionality
- Error handling for malformed JSON
- Responsive modal design

## Usage

### Viewing Payload Data
1. Navigate to the Provisioning Monitor page
2. Locate a row with a `{} JSON` badge in the Payload column
3. Click the badge to open the modal
4. View the formatted JSON data
5. Optionally copy the data using the "Copy" button
6. Optionally download the data using the "Download" button
7. Close the modal by clicking "Close", the X button, or clicking outside

### Downloading Payload Data
1. Open the payload modal by clicking the `{} JSON` badge
2. Click the "Download" button in the header
3. The file will be saved to your Downloads folder
4. Filename format: `{Title}_{Date}.json` (e.g., `Payload_Data_-_PS-12345_2026-01-14.json`)
5. Button shows "Saved!" confirmation for 2 seconds after successful download

### Data Source
The payload data comes from the `Payload_Data__c` field in the Salesforce Technical Team Request object. This field contains the raw JSON that was submitted with the provisioning request.

## Styling

### JSON Badge
```jsx
<button
  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium 
             text-amber-700 dark:text-amber-300 
             bg-amber-100 dark:bg-amber-900/30 
             hover:bg-amber-200 dark:hover:bg-amber-800/50 
             rounded transition-colors cursor-pointer"
>
  <span className="font-mono">{'{}'}</span> JSON
</button>
```

### Syntax Highlighting Colors
- **Keys**: `text-blue-300`
- **Strings**: `text-green-300`
- **Numbers**: `text-yellow-400`
- **Booleans**: `text-purple-400`
- **Null**: `text-red-400`

## Related Features

This implementation mirrors the functionality added to the Current Accounts page:
- See `frontend/src/pages/CurrentAccounts.jsx` for similar implementation
- Both pages use the same `RawDataModal` component for consistency

## Testing

### Manual Testing Steps
1. Navigate to Provisioning Monitor page
2. Find a request with payload data (should show JSON badge)
3. Click the JSON badge
4. Verify modal opens with formatted JSON
5. Verify syntax highlighting is applied
6. Click "Copy" button and verify clipboard contains JSON
7. Click "Close" button and verify modal closes
8. Click outside modal and verify it closes

### Edge Cases
- Requests without `Payload_Data__c` should show em-dash (—)
- Malformed JSON should display with warning message
- Large payloads should be scrollable within modal

## Files Modified

### Modified Files
- `frontend/src/pages/ProvisioningRequests.jsx` - Added payload column and modal integration

### Reused Files
- `frontend/src/components/features/RawDataModal.jsx` - Existing modal component

## Future Enhancements

1. **Search within JSON**: Add search functionality to find specific keys/values
2. **Collapse/Expand**: Add ability to collapse/expand JSON sections
3. **Diff View**: Compare payloads between related requests
4. **Schema Validation**: Validate payload against expected schema

# Excel Polling VBA Code for Remote Users

This VBA code is for **remote users** who don't have direct access to the Deploy Assist API. Instead of calling the API directly, this code sets a "flag" in the shared Excel file that triggers the polling service running on the host machine.

## How It Works

1. Remote user enters tenant name and PS record in Excel
2. Remote user clicks "Submit Lookup" button
3. VBA sets the FLAG cell to "PENDING"
4. Deploy Assist (running on host machine) polls the file via Microsoft Graph API
5. When it sees FLAG = "PENDING", it processes the request
6. Results are written to the SML Entitlements and Comparison sheets
7. FLAG is set to "COMPLETE"
8. VBA detects completion and notifies the user

## Excel Sheet Setup

### Lookup Sheet Layout

| Cell | Content | Description |
|------|---------|-------------|
| A2 | "Tenant:" | Label |
| B2 | (user input) | Tenant name or ID |
| A3 | "PS Record:" | Label |
| B3 | (user input) | PS record name (optional) |
| A4 | "Force Fresh:" | Label |
| B4 | (user input) | YES or NO |
| A5 | "Requested By:" | Label |
| B5 | (user input) | User name (optional) |
| D2 | (auto-filled) | Status |
| D3 | (auto-filled) | Error message |
| D4 | (auto-filled) | Timestamp |
| A8 | "Action:" | Label |
| B8 | (user input/output) | FLAG - Enter "Pull Data" to trigger, shows "Completed" when done |

## Complete VBA Code

Copy this entire code into a new VBA module:

```vba
Option Explicit

' ============================================
' Excel Lookup - Polling Version
' For remote users without direct API access
' ============================================

' Configuration
Const MAX_WAIT_SECONDS As Integer = 60    ' Maximum time to wait for results
Const POLL_INTERVAL_SECONDS As Integer = 2 ' How often to check for completion

' Cell locations
Const CELL_TENANT As String = "B2"
Const CELL_PS_RECORD As String = "B3"
Const CELL_FORCE_FRESH As String = "B4"
Const CELL_REQUESTED_BY As String = "B5"
Const CELL_STATUS As String = "D2"
Const CELL_ERROR As String = "D3"
Const CELL_TIMESTAMP As String = "D4"
Const CELL_FLAG As String = "B8"

' Flag values
Const FLAG_TRIGGER As String = "Pull Data"
Const FLAG_PROCESSING As String = "Processing..."
Const FLAG_COMPLETE As String = "Completed"
Const FLAG_ERROR As String = "Error"

' ============================================
' Main Entry Point - Called by button
' ============================================
Public Sub SubmitLookup()
    Dim wsLookup As Worksheet
    Dim tenantInput As String
    Dim psRecord As String
    Dim forceFresh As String
    Dim requestedBy As String
    
    On Error GoTo ErrorHandler
    
    ' Get Lookup sheet
    Set wsLookup = ThisWorkbook.Worksheets("Lookup")
    
    ' Read inputs
    tenantInput = Trim(wsLookup.Range(CELL_TENANT).Value)
    psRecord = Trim(wsLookup.Range(CELL_PS_RECORD).Value)
    forceFresh = UCase(Trim(wsLookup.Range(CELL_FORCE_FRESH).Value))
    requestedBy = Trim(wsLookup.Range(CELL_REQUESTED_BY).Value)
    
    ' Validate
    If tenantInput = "" Then
        MsgBox "Please enter a Tenant Name or ID.", vbExclamation, "Input Required"
        wsLookup.Range(CELL_TENANT).Select
        Exit Sub
    End If
    
    ' Set default for requestedBy
    If requestedBy = "" Then
        requestedBy = Environ("USERNAME")
        wsLookup.Range(CELL_REQUESTED_BY).Value = requestedBy
    End If
    
    ' Clear previous results
    wsLookup.Range(CELL_STATUS).Value = "Submitting..."
    wsLookup.Range(CELL_ERROR).Value = ""
    wsLookup.Range(CELL_TIMESTAMP).Value = Now()
    
    ' Set FLAG to "Pull Data" - this triggers the polling service
    wsLookup.Range(CELL_FLAG).Value = FLAG_TRIGGER
    
    ' Save the workbook to sync changes to OneDrive
    Application.StatusBar = "Saving to OneDrive..."
    ThisWorkbook.Save
    
    ' Wait for results
    Application.StatusBar = "Waiting for Deploy Assist to process request..."
    WaitForResults wsLookup
    
    Application.StatusBar = False
    Exit Sub
    
ErrorHandler:
    Application.StatusBar = False
    wsLookup.Range(CELL_STATUS).Value = "Error"
    wsLookup.Range(CELL_ERROR).Value = "VBA Error: " & Err.Description
    wsLookup.Range(CELL_FLAG).Value = FLAG_ERROR
    MsgBox "Error: " & Err.Description, vbCritical, "Lookup Failed"
End Sub

' ============================================
' Wait for the polling service to complete
' ============================================
Private Sub WaitForResults(wsLookup As Worksheet)
    Dim startTime As Double
    Dim elapsed As Integer
    Dim flagValue As String
    Dim statusValue As String
    
    startTime = Timer
    
    Do
        ' Calculate elapsed time
        elapsed = CInt(Timer - startTime)
        
        ' Check for timeout
        If elapsed > MAX_WAIT_SECONDS Then
            wsLookup.Range(CELL_STATUS).Value = "Timeout"
            wsLookup.Range(CELL_ERROR).Value = "Request timed out after " & MAX_WAIT_SECONDS & " seconds. " & _
                "Make sure Deploy Assist polling is running on the host machine."
            MsgBox "Request timed out. Please ensure Deploy Assist is running with polling enabled.", _
                   vbExclamation, "Timeout"
            Exit Sub
        End If
        
        ' Update status bar
        Application.StatusBar = "Waiting for results... (" & elapsed & "s)"
        
        ' Wait before next check
        Application.Wait Now + TimeValue("00:00:" & Format(POLL_INTERVAL_SECONDS, "00"))
        
        ' Refresh to get latest data from OneDrive
        ' Note: This may or may not trigger a sync depending on OneDrive settings
        DoEvents
        
        ' Read current flag value
        flagValue = UCase(Trim(wsLookup.Range(CELL_FLAG).Value))
        statusValue = Trim(wsLookup.Range(CELL_STATUS).Value)
        
        ' Check if complete or error
        Select Case flagValue
            Case FLAG_COMPLETE
                MsgBox "Lookup complete! Check the 'SML Entitlements' and 'Comparison' sheets for results.", _
                       vbInformation, "Success"
                Exit Sub
                
            Case FLAG_ERROR
                MsgBox "Lookup failed: " & wsLookup.Range(CELL_ERROR).Value, _
                       vbExclamation, "Error"
                Exit Sub
                
            Case FLAG_PROCESSING
                ' Still working, continue waiting
                
            Case FLAG_TRIGGER
                ' Not picked up yet, continue waiting
                
            Case Else
                ' Unknown state, might be an issue
        End Select
        
    Loop
End Sub

' ============================================
' Clear all results
' ============================================
Public Sub ClearResults()
    Dim wsLookup As Worksheet
    Dim wsSML As Worksheet
    Dim wsCompare As Worksheet
    
    On Error Resume Next
    
    Set wsLookup = ThisWorkbook.Worksheets("Lookup")
    Set wsSML = ThisWorkbook.Worksheets("SML Entitlements")
    Set wsCompare = ThisWorkbook.Worksheets("Comparison")
    
    ' Clear Lookup sheet outputs
    wsLookup.Range(CELL_STATUS).Value = ""
    wsLookup.Range(CELL_ERROR).Value = ""
    wsLookup.Range(CELL_TIMESTAMP).Value = ""
    wsLookup.Range(CELL_FLAG).Value = ""
    
    ' Clear SML Entitlements sheet
    If Not wsSML Is Nothing Then
        wsSML.Cells.Clear
    End If
    
    ' Clear Comparison sheet
    If Not wsCompare Is Nothing Then
        wsCompare.Cells.Clear
    End If
    
    MsgBox "Results cleared.", vbInformation, "Clear"
End Sub

' ============================================
' Check if polling service is responding
' ============================================
Public Sub CheckPollingStatus()
    Dim flagValue As String
    Dim wsLookup As Worksheet
    
    Set wsLookup = ThisWorkbook.Worksheets("Lookup")
    flagValue = UCase(Trim(wsLookup.Range(CELL_FLAG).Value))
    
    Dim msg As String
    msg = "Current FLAG value: " & flagValue & vbCrLf & vbCrLf
    
    Select Case flagValue
        Case ""
            msg = msg & "Status: Ready for new request" & vbCrLf & _
                  "The FLAG cell is empty. Enter 'Pull Data' to submit a lookup."
        Case FLAG_TRIGGER
            msg = msg & "Status: Waiting for Deploy Assist" & vbCrLf & _
                  "A request is pending. Make sure Deploy Assist polling is enabled."
        Case FLAG_PROCESSING
            msg = msg & "Status: Processing" & vbCrLf & _
                  "Deploy Assist is currently processing your request."
        Case FLAG_COMPLETE
            msg = msg & "Status: Complete" & vbCrLf & _
                  "The last request completed successfully. Check results sheets."
        Case FLAG_ERROR
            msg = msg & "Status: Error" & vbCrLf & _
                  "The last request had an error: " & wsLookup.Range(CELL_ERROR).Value
        Case Else
            msg = msg & "Status: Unknown (" & flagValue & ")" & vbCrLf & _
                  "Unexpected flag value. Try clearing and submitting again."
    End Select
    
    MsgBox msg, vbInformation, "Polling Status"
End Sub

' ============================================
' Reset flag (use if stuck)
' ============================================
Public Sub ResetFlag()
    Dim wsLookup As Worksheet
    Set wsLookup = ThisWorkbook.Worksheets("Lookup")
    
    wsLookup.Range(CELL_FLAG).Value = ""
    wsLookup.Range(CELL_STATUS).Value = "Reset"
    
    MsgBox "Flag has been reset. You can now submit a new request.", vbInformation, "Reset"
End Sub
```

## Setup Instructions for Remote Users

### 1. Open the Shared Excel File

Open the shared Excel file from OneDrive. Make sure you have edit permissions.

### 2. Enable Macros

If prompted, click "Enable Content" or "Enable Macros".

### 3. Open VBA Editor

Press `Alt + F11` to open the VBA editor.

### 4. Insert Module

1. In the VBA editor, right-click on "VBAProject (YourFileName.xlsx)"
2. Select **Insert → Module**
3. Paste the VBA code above into the new module

### 5. Create Buttons (Optional)

To create buttons for easy access:

1. Go to **Developer** tab (enable via File → Options → Customize Ribbon)
2. Click **Insert → Button (Form Control)**
3. Draw button on the Lookup sheet
4. Assign macro: `SubmitLookup`
5. Change button text to "Submit Lookup"

Repeat for other macros:
- `ClearResults` → "Clear Results"
- `CheckPollingStatus` → "Check Status"
- `ResetFlag` → "Reset"

### 6. Ensure OneDrive Sync

- Make sure the Excel file is synced via OneDrive
- Changes should sync automatically
- The polling service will detect changes via Microsoft Graph API

## Troubleshooting

### "Request timed out"

- Ensure Deploy Assist is running on the host machine
- Ensure polling is enabled (check `/api/excel-polling/status`)
- Try increasing `MAX_WAIT_SECONDS` in VBA

### "FLAG stuck on PENDING"

1. Check if Deploy Assist is running
2. Check if polling is started (`POST /api/excel-polling/start`)
3. Use "Reset" button to clear the flag
4. Check Deploy Assist console for errors

### OneDrive not syncing

- Force sync: Right-click OneDrive icon → "Sync now"
- Check if file is locked by another user
- Close and reopen the file

### Results not appearing

- Check the "SML Entitlements" and "Comparison" sheets
- If sheets don't exist, they will be created automatically
- Refresh Excel (`Ctrl + Alt + F5`) to see latest changes

## Host Machine Setup

On the machine running Deploy Assist:

### 1. Configure Polling

```powershell
# Configure the shared Excel file
$body = @{ shareUrl = "https://your-sharepoint-link..." } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/excel-polling/configure" -Method POST -ContentType "application/json" -Body $body
```

### 2. Start Polling

```powershell
# Start polling
Invoke-RestMethod -Uri "http://localhost:5000/api/excel-polling/start" -Method POST
```

### 3. Check Status

```powershell
# Check polling status
Invoke-RestMethod -Uri "http://localhost:5000/api/excel-polling/status"
```

### 4. Stop Polling

```powershell
# Stop polling
Invoke-RestMethod -Uri "http://localhost:5000/api/excel-polling/stop" -Method POST
```

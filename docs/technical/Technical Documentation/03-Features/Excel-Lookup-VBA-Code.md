# Excel Lookup VBA Code

## Overview

This document contains the complete VBA code for the Excel Lookup feature. Copy this code into your Excel workbook's VBA project (Alt+F11).

## Prerequisites

1. **Excel file with the following sheets:**
   - `Lookup` - Input area with tenant name, PS record, and button
   - `SML Entitlements` - Output for tenant's current SML entitlements
   - `Comparison` - Output for PS vs SML comparison

2. **Deploy Assist server running** at `http://localhost:5000`

## Complete VBA Code

Copy all the code below into a new VBA Module:

```vba
' ============================================
' Excel Lookup Module for Deploy Assist
' ============================================
' This module provides tenant lookup and PS record
' comparison functionality via the Deploy Assist API
' ============================================

Option Explicit

' ============================================
' CONFIGURATION - Update these as needed
' ============================================
Const API_BASE_URL As String = "http://localhost:5000"
Const LOOKUP_SHEET As String = "Lookup"
Const SML_SHEET As String = "SML Entitlements"
Const COMPARISON_SHEET As String = "Comparison"

' Input cell locations (on Lookup sheet)
Const TENANT_CELL As String = "B2"
Const PS_RECORD_CELL As String = "B3"
Const STATUS_CELL As String = "D2"
Const ERROR_CELL As String = "D3"
Const TIMESTAMP_CELL As String = "D4"

' ============================================
' MAIN LOOKUP FUNCTION
' Called by the Lookup button
' ============================================
Sub LookupTenant()
    Dim http As Object
    Dim url As String
    Dim tenantInput As String
    Dim psRecord As String
    Dim jsonBody As String
    Dim response As String
    Dim wsLookup As Worksheet
    
    On Error GoTo ErrorHandler
    
    Set wsLookup = ThisWorkbook.Sheets(LOOKUP_SHEET)
    
    ' Read inputs
    tenantInput = Trim(wsLookup.Range(TENANT_CELL).Value)
    psRecord = Trim(wsLookup.Range(PS_RECORD_CELL).Value)
    
    ' Validate input
    If tenantInput = "" Then
        wsLookup.Range(STATUS_CELL).Value = "Error"
        wsLookup.Range(ERROR_CELL).Value = "Please enter a tenant name or ID"
        Exit Sub
    End If
    
    ' Show loading status
    wsLookup.Range(STATUS_CELL).Value = "Loading..."
    wsLookup.Range(ERROR_CELL).Value = ""
    wsLookup.Range(TIMESTAMP_CELL).Value = ""
    Application.ScreenUpdating = True
    DoEvents
    
    ' Build API URL - use compare-excel for Excel-formatted output
    url = API_BASE_URL & "/api/excel-lookup/compare-excel"
    
    ' Build JSON body
    jsonBody = "{""tenantNameOrId"": """ & EscapeJsonString(tenantInput) & """"
    If psRecord <> "" Then
        jsonBody = jsonBody & ", ""psRecordName"": """ & EscapeJsonString(psRecord) & """"
    End If
    jsonBody = jsonBody & "}"
    
    ' Make HTTP request
    Set http = CreateObject("MSXML2.XMLHTTP.6.0")
    http.Open "POST", url, False
    http.setRequestHeader "Content-Type", "application/json"
    http.send jsonBody
    
    ' Check response
    If http.Status = 200 Then
        response = http.responseText
        
        ' Parse and write results
        Call ParseAndWriteResults(response, psRecord <> "")
        
        wsLookup.Range(STATUS_CELL).Value = "Success"
        wsLookup.Range(TIMESTAMP_CELL).Value = Format(Now, "yyyy-mm-dd hh:mm:ss")
        
    ElseIf http.Status = 404 Then
        wsLookup.Range(STATUS_CELL).Value = "Not Found"
        wsLookup.Range(ERROR_CELL).Value = "Tenant or PS record not found"
        
    Else
        wsLookup.Range(STATUS_CELL).Value = "Error"
        wsLookup.Range(ERROR_CELL).Value = "API returned: " & http.Status & " - " & Left(http.responseText, 200)
    End If
    
    Set http = Nothing
    Exit Sub
    
ErrorHandler:
    wsLookup.Range(STATUS_CELL).Value = "Error"
    wsLookup.Range(ERROR_CELL).Value = "Error: " & Err.Description
End Sub

' ============================================
' PARSE AND WRITE RESULTS
' Parses JSON response and writes to Excel sheets
' ============================================
Sub ParseAndWriteResults(jsonResponse As String, hasPSRecord As Boolean)
    Dim wsSML As Worksheet
    Dim wsComparison As Worksheet
    
    ' Get or create sheets
    Set wsSML = GetOrCreateSheet(SML_SHEET)
    Set wsComparison = GetOrCreateSheet(COMPARISON_SHEET)
    
    ' Clear existing data
    wsSML.Cells.Clear
    wsComparison.Cells.Clear
    
    ' Parse the JSON response
    Dim success As Boolean
    Dim errorMsg As String
    Dim smlEntitlements As String
    Dim comparison As String
    Dim summary As String
    
    success = GetJsonValue(jsonResponse, "success") = "true"
    
    If Not success Then
        errorMsg = GetJsonValue(jsonResponse, "error")
        ThisWorkbook.Sheets(LOOKUP_SHEET).Range(ERROR_CELL).Value = errorMsg
        Exit Sub
    End If
    
    ' Write SML Entitlements
    Call WriteSMLEntitlements(wsSML, jsonResponse)
    
    ' Write Comparison if PS record was provided
    If hasPSRecord Then
        Call WriteComparison(wsComparison, jsonResponse)
    Else
        wsComparison.Range("A1").Value = "No PS record provided - comparison not available"
        wsComparison.Range("A1").Font.Italic = True
    End If
    
    ' Write summary to Lookup sheet
    Call WriteSummary(jsonResponse)
End Sub

' ============================================
' WRITE SML ENTITLEMENTS SHEET
' ============================================
Sub WriteSMLEntitlements(ws As Worksheet, jsonResponse As String)
    Dim row As Long
    Dim i As Long
    Dim entitlement As String
    Dim entitlements As String
    
    ' Write headers
    ws.Range("A1").Value = "Product Code"
    ws.Range("B1").Value = "Type"
    ws.Range("C1").Value = "Package Name"
    ws.Range("D1").Value = "Start Date"
    ws.Range("E1").Value = "End Date"
    ws.Range("F1").Value = "Quantity"
    ws.Range("G1").Value = "Modifier"
    
    ' Format headers
    With ws.Range("A1:G1")
        .Font.Bold = True
        .Interior.Color = RGB(68, 114, 196)
        .Font.Color = RGB(255, 255, 255)
    End With
    
    ' Extract smlEntitlements array
    entitlements = GetJsonArray(jsonResponse, "smlEntitlements")
    
    row = 2
    i = 0
    
    Do While True
        entitlement = GetJsonArrayItem(entitlements, i)
        If entitlement = "" Then Exit Do
        
        ws.Cells(row, 1).Value = GetJsonValue(entitlement, "productCode")
        ws.Cells(row, 2).Value = GetJsonValue(entitlement, "type")
        ws.Cells(row, 3).Value = GetJsonValue(entitlement, "packageName")
        ws.Cells(row, 4).Value = GetJsonValue(entitlement, "startDate")
        ws.Cells(row, 5).Value = GetJsonValue(entitlement, "endDate")
        ws.Cells(row, 6).Value = GetJsonValue(entitlement, "quantity")
        ws.Cells(row, 7).Value = GetJsonValue(entitlement, "productModifier")
        
        row = row + 1
        i = i + 1
    Loop
    
    ' Auto-fit columns
    ws.Columns("A:G").AutoFit
    
    ' Add filter
    If row > 2 Then
        ws.Range("A1:G" & (row - 1)).AutoFilter
    End If
End Sub

' ============================================
' WRITE COMPARISON SHEET
' ============================================
Sub WriteComparison(ws As Worksheet, jsonResponse As String)
    Dim row As Long
    Dim i As Long
    Dim item As String
    Dim comparison As String
    Dim status As String
    Dim statusColor As String
    
    ' Write headers
    ws.Range("A1").Value = "Product Code"
    ws.Range("B1").Value = "Type"
    ws.Range("C1").Value = "Status"
    ws.Range("D1").Value = "SML Start"
    ws.Range("E1").Value = "SML End"
    ws.Range("F1").Value = "SML Package"
    ws.Range("G1").Value = "PS Start"
    ws.Range("H1").Value = "PS End"
    ws.Range("I1").Value = "PS Package"
    ws.Range("J1").Value = "Notes"
    
    ' Format headers
    With ws.Range("A1:J1")
        .Font.Bold = True
        .Interior.Color = RGB(68, 114, 196)
        .Font.Color = RGB(255, 255, 255)
    End With
    
    ' Extract comparison array
    comparison = GetJsonArray(jsonResponse, "comparison")
    
    row = 2
    i = 0
    
    Do While True
        item = GetJsonArrayItem(comparison, i)
        If item = "" Then Exit Do
        
        ws.Cells(row, 1).Value = GetJsonValue(item, "productCode")
        ws.Cells(row, 2).Value = GetJsonValue(item, "type")
        
        status = GetJsonValue(item, "status")
        statusColor = GetJsonValue(item, "statusColor")
        
        ws.Cells(row, 3).Value = status
        
        ' Apply color based on status
        Select Case UCase(statusColor)
            Case "GREEN"
                ws.Rows(row).Interior.Color = RGB(198, 239, 206)  ' Light green
            Case "RED"
                ws.Rows(row).Interior.Color = RGB(255, 199, 206)  ' Light red
            Case "YELLOW"
                ws.Rows(row).Interior.Color = RGB(255, 235, 156)  ' Light yellow
            Case "BLUE"
                ws.Rows(row).Interior.Color = RGB(189, 215, 238)  ' Light blue
        End Select
        
        ws.Cells(row, 4).Value = GetJsonValue(item, "smlStartDate")
        ws.Cells(row, 5).Value = GetJsonValue(item, "smlEndDate")
        ws.Cells(row, 6).Value = GetJsonValue(item, "smlPackage")
        ws.Cells(row, 7).Value = GetJsonValue(item, "psStartDate")
        ws.Cells(row, 8).Value = GetJsonValue(item, "psEndDate")
        ws.Cells(row, 9).Value = GetJsonValue(item, "psPackage")
        ws.Cells(row, 10).Value = GetJsonValue(item, "notes")
        
        row = row + 1
        i = i + 1
    Loop
    
    ' Auto-fit columns
    ws.Columns("A:J").AutoFit
    
    ' Add filter
    If row > 2 Then
        ws.Range("A1:J" & (row - 1)).AutoFilter
    End If
End Sub

' ============================================
' WRITE SUMMARY TO LOOKUP SHEET
' ============================================
Sub WriteSummary(jsonResponse As String)
    Dim ws As Worksheet
    Dim summaryJson As String
    
    Set ws = ThisWorkbook.Sheets(LOOKUP_SHEET)
    
    ' Get summary object
    summaryJson = GetJsonObject(jsonResponse, "summary")
    
    If summaryJson <> "" Then
        ' Write summary stats (adjust cell locations as needed)
        ws.Range("F2").Value = "In SF Only (Adding):"
        ws.Range("G2").Value = GetJsonValue(summaryJson, "inSFOnly")
        ws.Range("G2").Interior.Color = RGB(198, 239, 206)
        
        ws.Range("F3").Value = "In SML Only (Removing):"
        ws.Range("G3").Value = GetJsonValue(summaryJson, "inSMLOnly")
        ws.Range("G3").Interior.Color = RGB(255, 199, 206)
        
        ws.Range("F4").Value = "Different:"
        ws.Range("G4").Value = GetJsonValue(summaryJson, "different")
        ws.Range("G4").Interior.Color = RGB(255, 235, 156)
        
        ws.Range("F5").Value = "Matching:"
        ws.Range("G5").Value = GetJsonValue(summaryJson, "matching")
        ws.Range("G5").Interior.Color = RGB(189, 215, 238)
        
        ' Overall status
        Dim hasDiscrepancies As Boolean
        hasDiscrepancies = GetJsonValue(summaryJson, "hasDiscrepancies") = "true"
        
        ws.Range("F6").Value = "Overall:"
        If hasDiscrepancies Then
            ws.Range("G6").Value = "Has Discrepancies"
            ws.Range("G6").Font.Color = RGB(192, 0, 0)
            ws.Range("G6").Font.Bold = True
        Else
            ws.Range("G6").Value = "All Match"
            ws.Range("G6").Font.Color = RGB(0, 128, 0)
            ws.Range("G6").Font.Bold = True
        End If
    End If
End Sub

' ============================================
' HELPER: Get or create a worksheet
' ============================================
Function GetOrCreateSheet(sheetName As String) As Worksheet
    Dim ws As Worksheet
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(sheetName)
    On Error GoTo 0
    
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        ws.Name = sheetName
    End If
    
    Set GetOrCreateSheet = ws
End Function

' ============================================
' HELPER: Escape string for JSON
' ============================================
Function EscapeJsonString(s As String) As String
    Dim result As String
    result = s
    result = Replace(result, "\", "\\")
    result = Replace(result, """", "\""")
    result = Replace(result, vbCr, "\r")
    result = Replace(result, vbLf, "\n")
    result = Replace(result, vbTab, "\t")
    EscapeJsonString = result
End Function

' ============================================
' SIMPLE JSON PARSER FUNCTIONS
' These are basic parsers for the expected JSON structure
' ============================================

' Get a simple value from JSON (string, number, boolean)
Function GetJsonValue(json As String, key As String) As String
    Dim pattern As String
    Dim startPos As Long
    Dim endPos As Long
    Dim value As String
    
    ' Look for "key": "value" or "key": value
    pattern = """" & key & """:"
    startPos = InStr(1, json, pattern, vbTextCompare)
    
    If startPos = 0 Then
        GetJsonValue = ""
        Exit Function
    End If
    
    startPos = startPos + Len(pattern)
    
    ' Skip whitespace
    Do While Mid(json, startPos, 1) = " "
        startPos = startPos + 1
    Loop
    
    ' Check if value is quoted string
    If Mid(json, startPos, 1) = """" Then
        startPos = startPos + 1
        endPos = InStr(startPos, json, """")
        If endPos > 0 Then
            value = Mid(json, startPos, endPos - startPos)
        End If
    ' Check for null
    ElseIf Mid(json, startPos, 4) = "null" Then
        value = ""
    ' Check for boolean or number
    Else
        endPos = startPos
        Do While endPos <= Len(json)
            Dim c As String
            c = Mid(json, endPos, 1)
            If c = "," Or c = "}" Or c = "]" Then Exit Do
            endPos = endPos + 1
        Loop
        value = Trim(Mid(json, startPos, endPos - startPos))
    End If
    
    GetJsonValue = value
End Function

' Get a JSON array as a string
Function GetJsonArray(json As String, key As String) As String
    Dim pattern As String
    Dim startPos As Long
    Dim bracketCount As Long
    Dim i As Long
    
    pattern = """" & key & """:"
    startPos = InStr(1, json, pattern, vbTextCompare)
    
    If startPos = 0 Then
        GetJsonArray = ""
        Exit Function
    End If
    
    startPos = startPos + Len(pattern)
    
    ' Skip to opening bracket
    Do While startPos <= Len(json) And Mid(json, startPos, 1) <> "["
        startPos = startPos + 1
    Loop
    
    If startPos > Len(json) Then
        GetJsonArray = ""
        Exit Function
    End If
    
    ' Find matching closing bracket
    bracketCount = 1
    i = startPos + 1
    
    Do While i <= Len(json) And bracketCount > 0
        Select Case Mid(json, i, 1)
            Case "["
                bracketCount = bracketCount + 1
            Case "]"
                bracketCount = bracketCount - 1
        End Select
        i = i + 1
    Loop
    
    GetJsonArray = Mid(json, startPos, i - startPos)
End Function

' Get a JSON object as a string
Function GetJsonObject(json As String, key As String) As String
    Dim pattern As String
    Dim startPos As Long
    Dim braceCount As Long
    Dim i As Long
    
    pattern = """" & key & """:"
    startPos = InStr(1, json, pattern, vbTextCompare)
    
    If startPos = 0 Then
        GetJsonObject = ""
        Exit Function
    End If
    
    startPos = startPos + Len(pattern)
    
    ' Skip to opening brace
    Do While startPos <= Len(json) And Mid(json, startPos, 1) <> "{"
        startPos = startPos + 1
    Loop
    
    If startPos > Len(json) Then
        GetJsonObject = ""
        Exit Function
    End If
    
    ' Find matching closing brace
    braceCount = 1
    i = startPos + 1
    
    Do While i <= Len(json) And braceCount > 0
        Select Case Mid(json, i, 1)
            Case "{"
                braceCount = braceCount + 1
            Case "}"
                braceCount = braceCount - 1
        End Select
        i = i + 1
    Loop
    
    GetJsonObject = Mid(json, startPos, i - startPos)
End Function

' Get an item from a JSON array by index
Function GetJsonArrayItem(jsonArray As String, index As Long) As String
    Dim i As Long
    Dim braceCount As Long
    Dim bracketCount As Long
    Dim inString As Boolean
    Dim itemStart As Long
    Dim currentIndex As Long
    Dim c As String
    
    If Left(jsonArray, 1) <> "[" Then
        GetJsonArrayItem = ""
        Exit Function
    End If
    
    currentIndex = 0
    itemStart = 2  ' Skip opening bracket
    braceCount = 0
    bracketCount = 0
    inString = False
    
    For i = 2 To Len(jsonArray)
        c = Mid(jsonArray, i, 1)
        
        ' Handle string boundaries
        If c = """" And Mid(jsonArray, i - 1, 1) <> "\" Then
            inString = Not inString
        End If
        
        If Not inString Then
            Select Case c
                Case "{"
                    braceCount = braceCount + 1
                Case "}"
                    braceCount = braceCount - 1
                Case "["
                    bracketCount = bracketCount + 1
                Case "]"
                    bracketCount = bracketCount - 1
                    If bracketCount < 0 Then
                        ' End of array
                        If currentIndex = index Then
                            GetJsonArrayItem = Trim(Mid(jsonArray, itemStart, i - itemStart))
                            Exit Function
                        End If
                        GetJsonArrayItem = ""
                        Exit Function
                    End If
                Case ","
                    If braceCount = 0 And bracketCount = 0 Then
                        If currentIndex = index Then
                            GetJsonArrayItem = Trim(Mid(jsonArray, itemStart, i - itemStart))
                            Exit Function
                        End If
                        currentIndex = currentIndex + 1
                        itemStart = i + 1
                    End If
            End Select
        End If
    Next i
    
    GetJsonArrayItem = ""
End Function

' ============================================
' CLEAR RESULTS
' Clears all output sheets
' ============================================
Sub ClearResults()
    Dim ws As Worksheet
    
    On Error Resume Next
    
    Set ws = ThisWorkbook.Sheets(SML_SHEET)
    If Not ws Is Nothing Then ws.Cells.Clear
    
    Set ws = ThisWorkbook.Sheets(COMPARISON_SHEET)
    If Not ws Is Nothing Then ws.Cells.Clear
    
    Set ws = ThisWorkbook.Sheets(LOOKUP_SHEET)
    If Not ws Is Nothing Then
        ws.Range(STATUS_CELL).Value = ""
        ws.Range(ERROR_CELL).Value = ""
        ws.Range(TIMESTAMP_CELL).Value = ""
        ws.Range("F2:G6").Clear
    End If
    
    On Error GoTo 0
    
    MsgBox "Results cleared.", vbInformation, "Clear"
End Sub
```

## Setting Up the Excel Workbook

### 1. Create the Lookup Sheet

On the `Lookup` sheet, set up the following:

| Cell | Content |
|------|---------|
| A1 | **Input** (header) |
| A2 | Tenant Name/ID: |
| A3 | PS Record: |
| B2 | (user input - tenant name) |
| B3 | (user input - PS record, optional) |
| C1 | **Status** (header) |
| D2 | (auto-filled status) |
| D3 | (auto-filled error message) |
| D4 | (auto-filled timestamp) |
| F1 | **Summary** (header) |
| F2-G6 | (auto-filled comparison summary) |

### 2. Add a Button

1. Go to Developer tab → Insert → Button (Form Control)
2. Draw the button on the Lookup sheet
3. Assign macro: `LookupTenant`
4. Label the button: "🔍 Lookup"

### 3. Add a Clear Button (Optional)

1. Add another button
2. Assign macro: `ClearResults`
3. Label: "🗑️ Clear"

## Usage

1. Enter a tenant name or ID in cell B2
2. Optionally enter a PS record name in cell B3
3. Click the "Lookup" button
4. Wait for results (may take 5-15 seconds for SML lookup)
5. View results:
   - `SML Entitlements` sheet: Current SML entitlements
   - `Comparison` sheet: Color-coded comparison (if PS record provided)
   - Summary on Lookup sheet: Quick overview of discrepancies

## Color Coding

| Color | Status | Meaning |
|-------|--------|---------|
| 🟢 Green | In SF Only | Adding entitlement (PS has it, SML doesn't) |
| 🔴 Red | In SML Only | Removing entitlement (SML has it, PS doesn't) |
| 🟡 Yellow | Different | Both have it, but attributes differ |
| 🔵 Blue | Match | Identical in both systems |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Server not reachable" | Make sure Deploy Assist is running on localhost:5000 |
| "Tenant not found" | Verify tenant name spelling, try tenant ID instead |
| "PS Record not found" | Verify PS record name (e.g., "PS-12345") |
| "SML token expired" | Refresh SML token in Deploy Assist web app |
| Slow response | SML lookup can take 5-15 seconds - be patient |

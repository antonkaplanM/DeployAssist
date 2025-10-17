' VBScript to run Node.js capture script without showing a window
' This script runs the PS audit capture in the background with no popup

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Build the command to run node
nodeCommand = "cmd /c cd /d """ & scriptDir & """ && node capture-ps-changes.js"

' Run the command with window style 0 (hidden)
' Parameters: command, windowStyle (0=hidden), waitOnReturn (false)
WshShell.Run nodeCommand, 0, False

Set WshShell = Nothing
Set fso = Nothing


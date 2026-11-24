Set-Location "E:\Projects\safe-connect"
python "project_management\journal_generator\journal_generator.py" --auto
if ($LASTEXITCODE -eq 3) {
    Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', 'Set-Location "E:\Projects\safe-connect"; Write-Host "`n[REMINDER] No Git commits found today. Please log today''s non-coding/planning journal entry:`n" -ForegroundColor Cyan; python "project_management\journal_generator\journal_generator.py"'
}

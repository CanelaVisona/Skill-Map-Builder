# PowerShell script to restart server
Write-Host "Killing node processes..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Start-Sleep -Seconds 2

Write-Host "Starting npm server..."
cd "C:\Users\Daniel Visona\Desktop\Skill-Map-Builder"
npm start

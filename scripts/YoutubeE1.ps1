<#
PowerShell test script for MCP Copilot bridge
Sends a POST to /gemini/chat with autoSession enabled and prints the response.
Usage examples:
  # Default
  pwsh ./scripts/test-session.ps1

  # Override message or iterations
  pwsh ./scripts/test-session.ps1 -Message "Open YouTube and search agentic ai" -MaxIterations 8

  # Turn off autoSession
  pwsh ./scripts/test-session.ps1 -AutoSession:$false
#>

param(
  [string]$Url = 'http://localhost:8765/gemini/chat',s
  [string]$Message = 'Open YouTube, search for agentic ai and start watching the 1st video',
  [string]$CurrentUrl = 'https://www.youtube.com',
  [switch]$AutoSession = $(\$true),
  [int]$MaxIterations = 10
)

try {
  $payload = [ordered]@{
    message = $Message
    context = @{ currentUrl = $CurrentUrl }
    autoSession = [bool]$AutoSession
    options = @{ maxIterations = $MaxIterations }
  } | ConvertTo-Json -Depth 10

  Write-Host "POSTing to $Url" -ForegroundColor Cyan
  Write-Host "Payload:`n$payload`n" -ForegroundColor DarkGray

  $resp = Invoke-RestMethod -Uri $Url -Method Post -ContentType 'application/json' -Body $payload -ErrorAction Stop

  Write-Host "Response (pretty):" -ForegroundColor Green
  $resp | ConvertTo-Json -Depth 10 | Write-Host
} catch {
  Write-Host "Request failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message
  if ($_.Exception.Response) {
    try { $_.Exception.Response | ConvertTo-Json -Depth 5 | Write-Host } catch {}
  }
  exit 1
}

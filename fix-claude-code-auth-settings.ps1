<#!
  Resets Claude Code / Cursor auth-related overrides:
  - Removes `env` from %USERPROFILE%\.claude\settings.json (localhost proxy, fake API key, skip login).
  - Removes `claudeCode.environmentVariables` from Cursor User settings.json if present.
  Backs up each file before change.

  Run:  powershell -ExecutionPolicy Bypass -File ".\fix-claude-code-auth-settings.ps1"
  Or:   Set-Location "d:\VS CODE\Claude.ai agent"; .\fix-claude-code-auth-settings.ps1
#>
$ErrorActionPreference = 'Stop'

function Backup-File {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $dir = Split-Path -Parent $Path
  $name = [IO.Path]::GetFileName($Path)
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $bak = Join-Path $dir "$name.bak-$stamp"
  Copy-Item -LiteralPath $Path -Destination $bak -Force
  return $bak
}

function Fix-ClaudeGlobalSettings {
  $path = Join-Path $env:USERPROFILE '.claude\settings.json'
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "[skip] Not found: $path"
    return
  }

  $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8
  $j = $raw | ConvertFrom-Json

  $removed = @()
  if ($null -ne $j.env) {
    $removed += 'env'
    $j.PSObject.Properties.Remove('env')
  }

  # Optional: uncomment to drop pinned model so the product UI picks default after subscription login
  # if ($null -ne $j.model) { $j.PSObject.Properties.Remove('model'); $removed += 'model' }

  if ($removed.Count -eq 0) {
    Write-Host "[ok]    No env block in: $path"
    return
  }

  $bak = Backup-File $path
  Write-Host "[backup] $bak"

  $out = $j | ConvertTo-Json -Depth 20
  Set-Content -LiteralPath $path -Value $out -Encoding UTF8 -NoNewline:$false
  Write-Host "[fixed] $path"
  Write-Host "        Removed: $($removed -join ', ')"
}

function Fix-CursorUserSettings {
  $path = Join-Path $env:APPDATA 'Cursor\User\settings.json'
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "[skip] Not found: $path"
    return
  }

  $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8
  $j = $raw | ConvertFrom-Json

  if (-not ($j.PSObject.Properties.Name -contains 'claudeCode.environmentVariables')) {
    Write-Host "[ok]    No claudeCode.environmentVariables in: $path"
    return
  }

  $bak = Backup-File $path
  Write-Host "[backup] $bak"

  $j.PSObject.Properties.Remove('claudeCode.environmentVariables')

  # Ensure login prompt is not suppressed by obsolete pairing (harmless if already false)
  if (-not ($j.PSObject.Properties.Name -contains 'claudeCode.disableLoginPrompt')) {
    Add-Member -InputObject $j -NotePropertyName 'claudeCode.disableLoginPrompt' -NotePropertyValue $false -Force
  } else {
    $j.'claudeCode.disableLoginPrompt' = $false
  }

  $out = $j | ConvertTo-Json -Depth 100
  Set-Content -LiteralPath $path -Value $out -Encoding UTF8 -NoNewline:$false
  Write-Host "[fixed] $path (removed claudeCode.environmentVariables; disableLoginPrompt=false)"
}

function Show-RelevantEnvHints {
  Write-Host ''
  Write-Host 'Check User/System env for overrides (Win+R -> sysdm.cpl -> Advanced -> Environment Variables):'
  foreach ($k in @('ANTHROPIC_BASE_URL','ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_SKIP_AUTH_LOGIN')) {
    $v = [Environment]::GetEnvironmentVariable($k, 'User')
    if ([string]::IsNullOrEmpty($v)) { $v = [Environment]::GetEnvironmentVariable($k, 'Machine') }
    if (-not [string]::IsNullOrEmpty($v)) {
      Write-Host "  $k = <set>"
    }
  }
  Write-Host 'If using normal Claude Code login: delete CLAUDE_CODE_SKIP_AUTH_LOGIN and ANTHROPIC_BASE_URL from env, then sign out/in or reboot.'
  Write-Host 'Reload Cursor after running this script.'
}

Write-Host '=== Fix Claude Code auth-related settings ===' 
Fix-ClaudeGlobalSettings
Fix-CursorUserSettings
Show-RelevantEnvHints

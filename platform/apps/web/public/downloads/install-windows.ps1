#Requires -Version 5.1
<#
.SYNOPSIS
    BUMEET agent — Windows installer
.DESCRIPTION
    Downloads the latest bumeet-agent binary from Azure Blob Storage, installs it
    to %LOCALAPPDATA%\BUMEET\ and registers a Task Scheduler task that starts
    the agent at login and auto-restarts it on failure.
.PARAMETER Token
    Your BUMEET API token (from the portal Device page). When provided the
    installer writes the initial config so the agent can sync BLE settings from
    the portal automatically.
.EXAMPLE
    # Run from PowerShell (admin not required):
    & ([scriptblock]::Create((irm https://app.bumeet.es/downloads/install-windows.ps1)))

    # With API token:
    & ([scriptblock]::Create((irm https://app.bumeet.es/downloads/install-windows.ps1))) -Token "your-token-here"
#>
param(
    [string]$Token = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ReleasesBaseUrl = "https://stbumeetreleases.blob.core.windows.net/releases"
$AssetName       = "bumeet-agent-windows.exe"
$InstallDir      = "$env:LOCALAPPDATA\BUMEET"
$BinaryPath      = "$InstallDir\bumeet-agent.exe"
$ConfigDir       = "$env:LOCALAPPDATA\bumeet\bumeet-agent"
$ConfigFile      = "$ConfigDir\config.json"
$LogDir          = "$env:LOCALAPPDATA\BUMEET\Logs"
$TaskName        = "BUMEET Agent"

Write-Host "→ Installing BUMEET agent for Windows" -ForegroundColor Cyan

# ── Download latest binary from Azure Blob Storage (public, no auth needed) ──
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir     | Out-Null

$tmpFile = [System.IO.Path]::GetTempFileName() + ".exe"
Write-Host "→ Downloading latest binary …"
Invoke-WebRequest -Uri "$ReleasesBaseUrl/latest/$AssetName" -OutFile $tmpFile -UseBasicParsing

# Stop the agent if it is currently running
$existing = Get-Process -Name "bumeet-agent" -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "→ Stopping running agent …"
    $existing | Stop-Process -Force
    Start-Sleep -Seconds 1
}

Copy-Item -Force $tmpFile $BinaryPath
Remove-Item $tmpFile

# ── Write initial config if token provided ────────────────────────────────────
if ($Token -ne "") {
    New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
    if (-not (Test-Path $ConfigFile)) {
        $config = @{
            api      = @{ url = "https://api.bumeet.es/api/v1"; token = $Token; poll_interval_seconds = 5 }
            ble      = @{}
            runtime  = @{ auto_connect_on_start = $false; poll_interval_seconds = 2 }
            telemetry = @{ enabled = $false }
        } | ConvertTo-Json -Depth 5
        $config | Set-Content -Path $ConfigFile -Encoding UTF8
        Write-Host "→ Config written to $ConfigFile"
    }
}

# ── Register Task Scheduler task ──────────────────────────────────────────────
Write-Host "→ Registering scheduled task '$TaskName' …"

# Remove old task if it exists
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$action  = New-ScheduledTaskAction -Execute $BinaryPath
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit 0 `
    -RestartCount 10 `
    -RestartInterval (New-TimeSpan -Seconds 30) `
    -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName  $TaskName `
    -Action    $action `
    -Trigger   $trigger `
    -Settings  $settings `
    -Principal $principal `
    -Force | Out-Null

# Start immediately without waiting for next login
Start-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "✓ BUMEET agent installed and started." -ForegroundColor Green
Write-Host "  Binary:  $BinaryPath"
Write-Host "  Logs:    $LogDir\agent.log  (once the agent writes them)"
Write-Host "  Config:  $ConfigFile"
if ($Token -eq "") {
    Write-Host ""
    Write-Host "  Next step: a browser window will open automatically to link the agent" -ForegroundColor Yellow
    Write-Host "  to your account. Log in at app.bumeet.es if prompted." -ForegroundColor Yellow
    Write-Host "  If no browser opens, visit: https://app.bumeet.es/device" -ForegroundColor Yellow
}

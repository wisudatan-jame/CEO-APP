# One-time setup of n8n for the CEO LINE bot on a Windows laptop.
# Put this file next to start-n8n.ps1 and .env.example, then run (normal PowerShell, no admin needed):
#   powershell -ExecutionPolicy Bypass -File .\install-n8n.ps1
$ErrorActionPreference = 'Stop'

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }

if (-not (Has 'winget')) {
    Write-Host "winget not found. Install 'App Installer' from Microsoft Store, then run this script again." -ForegroundColor Red
    exit 1
}

Step '1/5 Node.js LTS'
if (Has 'node') {
    Write-Host "Node.js already installed: $(node -v)"
} else {
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    Refresh-Path
    if (-not (Has 'node')) { Write-Host 'Node.js installed but not found in PATH. Close PowerShell, open a new one, and run this script again.' -ForegroundColor Yellow; exit 1 }
    Write-Host "Node.js: $(node -v)"
}

Step '2/5 n8n (this can take several minutes)'
if (Has 'n8n') {
    Write-Host 'n8n already installed.'
} else {
    npm install -g n8n
    Refresh-Path
    if (-not (Has 'n8n')) { Write-Host 'n8n installed but not found in PATH. Open a new PowerShell and run this script again.' -ForegroundColor Yellow; exit 1 }
}

Step '3/5 Cloudflare Tunnel (cloudflared)'
if (Has 'cloudflared') {
    Write-Host 'cloudflared already installed.'
} else {
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
    Refresh-Path
}

Step '4/5 Settings file (.env)'
$envFile = Join-Path $PSScriptRoot '.env'
$example = Join-Path $PSScriptRoot '.env.example'
if (-not (Test-Path $envFile)) {
    if (-not (Test-Path $example)) { Write-Host "Missing $example - put .env.example next to this script." -ForegroundColor Red; exit 1 }
    Copy-Item $example $envFile
    Write-Host "Created $envFile"
}
$content = Get-Content $envFile -Raw -Encoding UTF8
if ($content -match '(?m)^SP_WEBHOOK_CLIENT_STATE=\s*$') {
    $state = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    $content = $content -replace '(?m)^SP_WEBHOOK_CLIENT_STATE=\s*$', "SP_WEBHOOK_CLIENT_STATE=$state"
    Set-Content $envFile $content -Encoding UTF8 -NoNewline
    Write-Host 'Generated SP_WEBHOOK_CLIENT_STATE.'
}

Step '5/5 Keep the laptop awake while plugged in'
try {
    powercfg /change standby-timeout-ac 0
    Write-Host 'Sleep on AC power: never.'
} catch {
    Write-Host 'Could not change the power setting. Set Settings > System > Power > Sleep (plugged in) = Never.' -ForegroundColor Yellow
}

Write-Host "`nDone." -ForegroundColor Green
Write-Host 'Next: fill in the LINE and Microsoft values in .env (Notepad opens now), then run:'
Write-Host '   powershell -ExecutionPolicy Bypass -File .\start-all.ps1' -ForegroundColor Green
Start-Process notepad.exe $envFile

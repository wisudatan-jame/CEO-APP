# Starts the Cloudflare Tunnel, writes its public URL into .env, then starts n8n.
#   powershell -ExecutionPolicy Bypass -File .\start-all.ps1
$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path $envFile)) { Write-Host 'Missing .env - run install-n8n.ps1 first.' -ForegroundColor Red; exit 1 }

$log = Join-Path $env:TEMP 'ceo-n8n-tunnel.log'
Remove-Item $log -ErrorAction SilentlyContinue
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host 'Starting Cloudflare Tunnel...'
$tunnelExe = Join-Path $PSScriptRoot 'cloudflared.exe'
if (-not (Test-Path $tunnelExe)) { $tunnelExe = 'cloudflared' }
Start-Process $tunnelExe -ArgumentList 'tunnel', '--url', 'http://localhost:5678' -RedirectStandardError $log -NoNewWindow

$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $log) {
        $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches | Select-Object -First 1
        if ($m) { $url = $m.Matches[0].Value }
    }
}
if (-not $url) { Write-Host "Tunnel URL not found. See $log" -ForegroundColor Red; exit 1 }

$content = Get-Content $envFile -Raw -Encoding UTF8
$old = if ($content -match '(?m)^WEBHOOK_URL=(.*)$') { $Matches[1].Trim() } else { '' }
$content = if ($content -match '(?m)^WEBHOOK_URL=') { $content -replace '(?m)^WEBHOOK_URL=.*$', "WEBHOOK_URL=$url/" } else { "WEBHOOK_URL=$url/`r`n" + $content }
Set-Content $envFile $content -Encoding UTF8 -NoNewline

Write-Host "Tunnel URL: $url" -ForegroundColor Green
if ($old -ne "$url/") {
    Write-Host 'The URL changed. Update these two places:' -ForegroundColor Yellow
    Write-Host "  1) LINE Developers > Messaging API > Webhook URL = $url/webhook/ceo-line-bot  (then Verify)"
    Write-Host "  2) Re-run setup/create-webhook.js on the SharePoint site with $url/webhook/ceo-sp-hook"
}

& (Join-Path $PSScriptRoot 'start-n8n.ps1')

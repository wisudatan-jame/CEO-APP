# Starts n8n on this laptop with the settings in .env (same folder).
# Usage (PowerShell):  powershell -ExecutionPolicy Bypass -File .\start-n8n.ps1
$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path $envFile)) {
    Write-Host "Missing $envFile - copy .env.example to .env and fill it in." -ForegroundColor Red
    exit 1
}

Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { return }
    $name = $line.Substring(0, $i).Trim()
    $value = $line.Substring($i + 1).Trim()
    if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

# The bot's Code nodes read secrets from $env, which n8n blocks unless this is false.
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = 'false'
$env:GENERIC_TIMEZONE = 'Asia/Bangkok'
$env:TZ = 'Asia/Bangkok'

$required = @('WEBHOOK_URL', 'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'MS_TENANT_ID',
    'MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'SP_HOSTNAME', 'SP_SITE_PATH', 'SP_WEBHOOK_CLIENT_STATE')
$missing = $required | Where-Object { -not [Environment]::GetEnvironmentVariable($_, 'Process') }
if ($missing) {
    Write-Host ("Not set yet (the bot will fail until they are): " + ($missing -join ', ')) -ForegroundColor Yellow
}
if ($env:WEBHOOK_URL -and -not $env:WEBHOOK_URL.EndsWith('/')) {
    $env:WEBHOOK_URL = $env:WEBHOOK_URL + '/'
}
Write-Host "Webhook base: $env:WEBHOOK_URL"
Write-Host "LINE webhook URL:       $($env:WEBHOOK_URL)webhook/ceo-line-bot"
Write-Host "SharePoint webhook URL: $($env:WEBHOOK_URL)webhook/ceo-sp-hook"

n8n start

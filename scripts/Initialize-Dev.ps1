$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    Write-Host '.env already exists; it has been preserved.'
    exit 0
}
$randomBytes = New-Object byte[] 24
$randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $randomGenerator.GetBytes($randomBytes) } finally { $randomGenerator.Dispose() }
$localPassword = [BitConverter]::ToString($randomBytes).Replace('-', '').ToLowerInvariant()
$template = Get-Content -LiteralPath (Join-Path $projectRoot '.env.example') -Raw
$template = $template.Replace('example_only_replace_me', $localPassword)
[System.IO.File]::WriteAllText($envFile, $template, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Created local .env with a generated development password. Do not commit this file.'

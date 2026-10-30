$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $envFile)) { throw 'Run .\scripts\Initialize-Dev.ps1 first.' }
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
    if ($line -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$') { throw 'Invalid .env line. Use KEY=value without quotes.' }
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
}
if ([string]::IsNullOrWhiteSpace($env:POSTGRES_PASSWORD) -or $env:POSTGRES_PASSWORD -eq 'example_only_replace_me') {
    throw 'Set a local POSTGRES_PASSWORD in .env or regenerate it with Initialize-Dev.ps1.'
}

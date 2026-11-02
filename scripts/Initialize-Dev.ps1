$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'
function New-LocalPassword {
    $randomBytes = New-Object byte[] 24
    $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $randomGenerator.GetBytes($randomBytes) } finally { $randomGenerator.Dispose() }
    return [BitConverter]::ToString($randomBytes).Replace('-', '').ToLowerInvariant()
}
if (Test-Path -LiteralPath $envFile) {
    $template = [System.IO.File]::ReadAllText($envFile)
} else {
    $template = Get-Content -LiteralPath (Join-Path $projectRoot '.env.example') -Raw
    $template = $template.Replace('example_only_replace_me', (New-LocalPassword))
}
foreach ($key in @('DEMO_STAFF_PASSWORD', 'DEMO_KITCHEN_PASSWORD', 'DEMO_STAFF2_PASSWORD', 'DEMO_MANAGER_PASSWORD')) {
    if ($template -notmatch "(?m)^$key=") {
        $template = $template.TrimEnd() + "`n$key=$(New-LocalPassword)`n"
    }
}
[System.IO.File]::WriteAllText($envFile, $template, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Local .env ready. Existing values preserved; missing demo passwords generated. Do not commit this file.'

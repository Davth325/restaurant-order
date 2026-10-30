$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$processFile = Join-Path $projectRoot '.work/preview-process.json'
if (-not (Test-Path -LiteralPath $processFile)) { Write-Host 'No managed preview to stop.'; exit 0 }
$previewInfo = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
$previewProcess = Get-Process -Id $previewInfo.id -ErrorAction SilentlyContinue
if ($previewProcess) {
    if ($previewProcess.StartTime.ToUniversalTime().Ticks -ne $previewInfo.startedUtcTicks -or $previewProcess.ProcessName -ne 'java') {
        throw 'Preview process identity changed; refusing to stop a different process.'
    }
    Stop-Process -Id $previewInfo.id
    $previewProcess.WaitForExit(10000) | Out-Null
    Write-Host 'Managed preview stopped.'
} else { Write-Host 'Managed preview is already stopped.' }
Remove-Item -LiteralPath $processFile

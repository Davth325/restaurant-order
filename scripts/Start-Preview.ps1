$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Import-DevEnvironment.ps1')
. (Join-Path $PSScriptRoot 'Use-Java21.ps1')
$jarPath = Join-Path $projectRoot 'backend/build/libs/restaurant-order.jar'
$workFolder = Join-Path $projectRoot '.work'
$processFile = Join-Path $workFolder 'preview-process.json'
if (-not (Test-Path -LiteralPath $jarPath)) { throw 'Build first: .\scripts\dev.ps1 build' }
if (Test-Path -LiteralPath $processFile) {
    $previousPreview = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
    $previousProcess = Get-Process -Id $previousPreview.id -ErrorAction SilentlyContinue
    if ($previousProcess -and $previousProcess.StartTime.ToUniversalTime().Ticks -eq $previousPreview.startedUtcTicks) {
        Write-Host "Preview is already running: http://127.0.0.1:$env:BACKEND_PORT"
        exit 0
    }
}
New-Item -ItemType Directory -Path $workFolder -Force | Out-Null
$portProbe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, [int]$env:BACKEND_PORT)
try {
    $portProbe.Start()
} catch {
    throw "Port $env:BACKEND_PORT is already in use. Stop the foreground backend or select a different BACKEND_PORT in .env."
} finally { $portProbe.Stop() }
$javaExecutable = Join-Path $env:JAVA_HOME 'bin/java.exe'
$previewProcess = Start-Process -FilePath $javaExecutable -ArgumentList @('-jar', ('"' + $jarPath + '"')) `
    -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $workFolder 'preview.log') `
    -RedirectStandardError (Join-Path $workFolder 'preview.err.log')
@{ id = $previewProcess.Id; startedUtcTicks = $previewProcess.StartTime.ToUniversalTime().Ticks } |
    ConvertTo-Json | Set-Content -LiteralPath $processFile
$previewUrl = "http://127.0.0.1:$env:BACKEND_PORT"
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if ($previewProcess.HasExited) { throw 'Preview exited. Inspect .work/preview.log and .work/preview.err.log.' }
    try {
        $health = Invoke-RestMethod -Uri "$previewUrl/actuator/health" -TimeoutSec 2
        if ($health.status -eq 'UP') {
            Write-Host "Preview ready: $previewUrl"
            exit 0
        }
    } catch { }
    Start-Sleep -Seconds 1
}
throw 'Preview not ready yet. Inspect .work/preview.log. Use Stop-Preview.ps1 to stop it.'

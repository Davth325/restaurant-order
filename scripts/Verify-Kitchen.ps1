$ErrorActionPreference = 'Stop'
$verificationRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'Import-DevEnvironment.ps1')
. (Join-Path $PSScriptRoot 'Use-Java21.ps1')
$originalDb = $env:POSTGRES_DB
$originalPort = $env:BACKEND_PORT
$verificationDb = 'verify_kitchen_' + [Guid]::NewGuid().ToString('N')
if ($verificationDb -notmatch '^verify_kitchen_[a-f0-9]{32}$' -or $verificationDb -eq $originalDb) { throw 'Invalid verification database' }
$verificationProcess = $null
$databaseCreated = $false
$verificationJar = Join-Path $verificationRoot 'backend/build/libs/restaurant-order.jar'
if (-not (Test-Path -LiteralPath $verificationJar)) { throw 'Build the application first.' }
$portProbe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 8081)
try { $portProbe.Start() } finally { $portProbe.Stop() }

function Start-KitchenVerificationServer {
    $process = Start-Process -FilePath (Join-Path $env:JAVA_HOME 'bin/java.exe') -ArgumentList @('-jar', ('"' + $verificationJar + '"')) -WindowStyle Hidden -PassThru -WorkingDirectory $verificationRoot -RedirectStandardOutput (Join-Path $verificationRoot '.work/kitchen-server.log') -RedirectStandardError (Join-Path $verificationRoot '.work/kitchen-server.err.log')
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ($process.HasExited) { throw 'Verification server exited; inspect .work/kitchen-server.log' }
        try { if ((Invoke-RestMethod 'http://127.0.0.1:8081/actuator/health' -TimeoutSec 1).status -eq 'UP') { return $process } } catch { }
        Start-Sleep -Seconds 1
    }
    Stop-Process -Id $process.Id
    throw 'Verification health timeout'
}
try {
    docker exec restaurant-order-postgres-1 createdb -U $env:POSTGRES_USER $verificationDb
    if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated database' }
    $databaseCreated = $true
    $env:POSTGRES_DB = $verificationDb
    $env:BACKEND_PORT = '8081'
    $verificationProcess = Start-KitchenVerificationServer
    node (Join-Path $verificationRoot 'frontend/tests/verify-kitchen-live.cjs') open
    if ($LASTEXITCODE -ne 0) { throw 'Live kitchen flow failed' }
    Stop-Process -Id $verificationProcess.Id
    $verificationProcess.WaitForExit(10000) | Out-Null
    $verificationProcess = $null
    $verificationProcess = Start-KitchenVerificationServer
    node (Join-Path $verificationRoot 'frontend/tests/verify-kitchen-live.cjs') restart
    if ($LASTEXITCODE -ne 0) { throw 'Restart persistence check failed' }
    $counts = docker exec restaurant-order-postgres-1 psql -U $env:POSTGRES_USER -d $verificationDb -tAc 'SELECT count(*), sum(total_vnd) FROM order_batch'
    if ($LASTEXITCODE -ne 0 -or $counts.Trim() -ne '3|225000') { throw 'Unexpected committed batch count/total in isolated database' }

    $units = docker exec restaurant-order-postgres-1 psql -U $env:POSTGRES_USER -d $verificationDb -tAc "SELECT count(*), count(*) FILTER (WHERE status = 'READY') FROM fulfillment_unit"
    if ($LASTEXITCODE -ne 0 -or $units.Trim() -ne '5|3') { throw 'Unexpected per-unit database state' }
    Write-Host 'Verified kitchen UI/API/database, SSE/reconnect, partial portions and restart. Demo data untouched.'
} finally {
    if ($verificationProcess -and -not $verificationProcess.HasExited) {
        Stop-Process -Id $verificationProcess.Id
        $verificationProcess.WaitForExit(10000) | Out-Null
    }
    if ($databaseCreated -and $verificationDb -match '^verify_kitchen_[a-f0-9]{32}$' -and $verificationDb -ne $originalDb) {
        docker exec restaurant-order-postgres-1 dropdb -U $env:POSTGRES_USER --if-exists $verificationDb
        if ($LASTEXITCODE -ne 0) { Write-Warning "Could not remove isolated database $verificationDb" }
    }
    $env:POSTGRES_DB = $originalDb
    $env:BACKEND_PORT = $originalPort
}

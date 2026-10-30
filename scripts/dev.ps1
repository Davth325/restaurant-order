param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('db', 'backend', 'frontend', 'build', 'test', 'jar', 'status', 'stop')]
    [string]$Action
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'Import-DevEnvironment.ps1')

function Invoke-Checked {
    param([scriptblock]$Command)
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE)." }
}

Push-Location $projectRoot
try {
    switch ($Action) {
        'db' { Invoke-Checked { docker compose --env-file .env -f infra/compose.yaml up -d --wait --wait-timeout 90 } }
        'status' { Invoke-Checked { docker compose --env-file .env -f infra/compose.yaml ps } }
        'stop' { Invoke-Checked { docker compose --env-file .env -f infra/compose.yaml down } }
        'backend' {
            . (Join-Path $PSScriptRoot 'Use-Java21.ps1')
            Push-Location backend
            try { Invoke-Checked { .\gradlew.bat --no-daemon bootRun } } finally { Pop-Location }
        }
        'frontend' {
            Push-Location frontend
            try { Invoke-Checked { npm.cmd run dev } } finally { Pop-Location }
        }
        'build' {
            . (Join-Path $PSScriptRoot 'Use-Java21.ps1')
            Push-Location frontend
            try {
                Invoke-Checked { npm.cmd ci }
                Invoke-Checked { npm.cmd run lint }
                Invoke-Checked { npm.cmd run build }
            } finally { Pop-Location }
            Push-Location backend
            try { Invoke-Checked { .\gradlew.bat --no-daemon clean build } } finally { Pop-Location }
        }
        'test' {
            . (Join-Path $PSScriptRoot 'Use-Java21.ps1')
            Push-Location backend
            try { Invoke-Checked { .\gradlew.bat --no-daemon test --rerun-tasks } } finally { Pop-Location }
            Push-Location frontend
            try {
                Invoke-Checked { npm.cmd run typecheck }
                Invoke-Checked { npm.cmd run lint }
                Invoke-Checked { npm.cmd run test:e2e }
            } finally { Pop-Location }
        }
        'jar' {
            . (Join-Path $PSScriptRoot 'Use-Java21.ps1')
            Invoke-Checked { java -jar backend/build/libs/restaurant-order.jar }
        }
    }
} finally { Pop-Location }

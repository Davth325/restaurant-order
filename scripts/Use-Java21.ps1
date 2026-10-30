# Dot-source this file to select JDK 21 for the current terminal only.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$jdkCandidates = @($env:JDK21_HOME, $env:JAVA_HOME)
foreach ($jdkFolder in @('C:\Program Files\Java', 'C:\Program Files\Eclipse Adoptium', "$env:USERPROFILE\.jdks")) {
    if (Test-Path -LiteralPath $jdkFolder) {
        $jdkCandidates += Get-ChildItem -LiteralPath $jdkFolder -Directory | Select-Object -ExpandProperty FullName
    }
}
$selectedJdk = $null
foreach ($jdkCandidate in $jdkCandidates) {
    if (-not $jdkCandidate) { continue }
    $releaseFile = Join-Path $jdkCandidate 'release'
    if ((Test-Path -LiteralPath $releaseFile) -and
        ((Get-Content -LiteralPath $releaseFile -Raw) -match 'JAVA_VERSION="21[.\"]') -and
        (Test-Path -LiteralPath (Join-Path $jdkCandidate 'bin/javac.exe'))) {
        $selectedJdk = $jdkCandidate
        break
    }
}
if (-not $selectedJdk) { throw 'JDK 21 not found. Set JDK21_HOME to your JDK 21 folder and retry.' }
$env:JAVA_HOME = $selectedJdk
$env:Path = "$selectedJdk\bin;$env:Path"
# Keep generated Gradle files in the project; this directory is ignored by Git.
$env:GRADLE_USER_HOME = Join-Path $projectRoot '.work/gradle'

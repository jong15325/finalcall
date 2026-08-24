$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$backendDir = Join-Path $repoRoot 'backend'
$logDir = Join-Path $backendDir 'logs'

foreach ($name in 'dev-frontend', 'dev-gateway', 'dev-backend') {
    $pidFile = Join-Path $logDir "$name.pid"
    if (-not (Test-Path -LiteralPath $pidFile)) {
        continue
    }
    $processId = Get-Content -LiteralPath $pidFile
    & taskkill.exe /PID $processId /T /F 2>$null | Out-Null
    Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
}

docker compose `
    -f (Join-Path $backendDir 'docker-compose.local.yml') `
    -f (Join-Path $backendDir 'docker-compose.ports.yml') down

Write-Host 'FinalCall 애플리케이션과 로컬 인프라를 종료했습니다. Docker 볼륨은 유지됩니다.'

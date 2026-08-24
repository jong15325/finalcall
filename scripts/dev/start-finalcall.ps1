$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
$logDir = Join-Path $backendDir 'logs'
$composeBase = Join-Path $backendDir 'docker-compose.local.yml'
$composePorts = Join-Path $backendDir 'docker-compose.ports.yml'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (-not $env:JAVA_HOME) {
    $javaCandidates = @(
        'C:\Users\howee\.jdks\ms-21.0.11',
        'C:\Program Files\Java\jdk-21'
    )
    $javaHome = $javaCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $javaHome) {
        throw 'Java 21 설치 경로를 찾지 못했습니다. JAVA_HOME을 설정해 주세요.'
    }
    $env:JAVA_HOME = $javaHome
}

# 로컬 비밀값은 커밋되지 않는 backend/.env에서만 읽고 프로세스 환경으로 전달한다.
$envFile = Join-Path $backendDir '.env'
if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*#' -or $line -notmatch '=') {
            continue
        }
        $name, $value = $line -split '=', 2
        [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process')
    }
}

$env:GATEWAY_PORT = '28080'
$env:DB_URL = 'jdbc:mysql://localhost:23306/finalcall'
$env:REDIS_HOST = 'localhost'
$env:REDIS_PORT = '26379'
$env:ELASTICSEARCH_URIS = 'http://localhost:29200'
$env:KAFKA_BOOTSTRAP_SERVERS = 'localhost:39092'
$env:BOARD_IMAGE_ENDPOINT = 'http://localhost:39000'
$env:SERVICE_URI = 'http://localhost:28081'
$env:SERVICE_WS_URI = 'ws://localhost:28081'
$env:CHAT_ALLOWED_ORIGINS = 'http://localhost:23000,http://127.0.0.1:23000'
$env:OAUTH_REDIRECT_URI = 'http://localhost:23000/oauth/callback'
$env:VITE_DEV_API_TARGET = 'http://localhost:28080'

docker compose -f $composeBase -f $composePorts up -d

$backend = Start-Process -FilePath (Join-Path $repoRoot 'gradlew.bat') `
    -ArgumentList ':backend:bootRun', '--args=--server.port=28081' -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logDir 'dev-backend.out.log') `
    -RedirectStandardError (Join-Path $logDir 'dev-backend.err.log')
$backend.Id | Set-Content -LiteralPath (Join-Path $logDir 'dev-backend.pid')

$gateway = Start-Process -FilePath (Join-Path $repoRoot 'gradlew.bat') `
    -ArgumentList ':backend:gateway:bootRun', '--args=--server.port=28080' -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logDir 'dev-gateway.out.log') `
    -RedirectStandardError (Join-Path $logDir 'dev-gateway.err.log')
$gateway.Id | Set-Content -LiteralPath (Join-Path $logDir 'dev-gateway.pid')

$frontend = Start-Process -FilePath 'npm.cmd' `
    -ArgumentList 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '23000' `
    -WorkingDirectory $frontendDir -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logDir 'dev-frontend.out.log') `
    -RedirectStandardError (Join-Path $logDir 'dev-frontend.err.log')
$frontend.Id | Set-Content -LiteralPath (Join-Path $logDir 'dev-frontend.pid')

Write-Host "FinalCall 실행을 시작했습니다. frontend=23000, gateway=28080, backend=28081"

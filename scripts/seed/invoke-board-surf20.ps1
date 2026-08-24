param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dry-run', 'apply', 'status', 'cleanup')]
    [string]$Command
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path "$PSScriptRoot/../..").Path
$envFile = Join-Path $repoRoot '.env.deploy'
if (-not (Test-Path -LiteralPath $envFile)) { throw '.env.deploy 파일이 필요합니다.' }

$values = @{}
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $name, $value = $line -split '=', 2
    $values[$name.Trim()] = $value.Trim()
}

$database = $values['DB_NAME']
if ([string]::IsNullOrWhiteSpace($database)) { $database = 'finalcall' }
$scenario = 'board-surf-20-v1'
$expected = "mysql:3306/$database`:$scenario"
if ($values['SEED_CONFIRM_TARGET_FINGERPRINT'] -ne $expected) {
    throw "대상 fingerprint가 일치하지 않습니다. 예상값: $expected"
}
if ($Command -in @('apply', 'cleanup')) {
    if ($values['SEED_ALLOW_PROD'] -ne 'true') { throw '쓰기에는 SEED_ALLOW_PROD=true가 필요합니다.' }
    if ($values['SEED_CONFIRM_WRITE'] -ne "$($Command.ToUpperInvariant()):$expected") {
        throw '명령별 SEED_CONFIRM_WRITE가 일치하지 않습니다.'
    }
}

$names = @('SEED_SCENARIO', 'SEED_CONFIRM_TARGET_FINGERPRINT', 'SEED_CONFIRM_WRITE', 'SEED_ALLOW_PROD')
$previous = @{}
try {
    $runtime = @{
        SEED_JDBC_URL = "jdbc:mysql://mysql:3306/$database"
        SEED_DB_USERNAME = $values['DB_USERNAME']
        SEED_DB_PASSWORD = $values['DB_PASSWORD']
        SEED_SCENARIO = $scenario
        SEED_CONFIRM_TARGET_FINGERPRINT = $values['SEED_CONFIRM_TARGET_FINGERPRINT']
        SEED_CONFIRM_WRITE = $values['SEED_CONFIRM_WRITE']
        SEED_ALLOW_PROD = $values['SEED_ALLOW_PROD']
    }
    foreach ($name in $runtime.Keys) {
        if ([string]::IsNullOrWhiteSpace($runtime[$name])) { throw "$name 값이 필요합니다." }
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $runtime[$name], 'Process')
    }
    Write-Host "FinalCall board seed 대상: mysql:3306/$database, 명령: $Command"
    docker run --rm --network finalcall-app-network --entrypoint java `
        -e SEED_JDBC_URL -e SEED_DB_USERNAME -e SEED_DB_PASSWORD -e SEED_SCENARIO `
        -e SEED_CONFIRM_TARGET_FINGERPRINT -e SEED_CONFIRM_WRITE -e SEED_ALLOW_PROD `
        finalcall-backend:local '-Dloader.main=com.finalcall.support.seed.BoardSeedCli' `
        -cp /app/app.jar org.springframework.boot.loader.launch.PropertiesLauncher $Command
    if ($LASTEXITCODE -ne 0) { throw "시드 컨테이너가 종료 코드 $LASTEXITCODE 로 실패했습니다." }
} finally {
    foreach ($name in $runtime.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
}

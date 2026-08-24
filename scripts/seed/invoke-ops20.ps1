param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dry-run', 'apply', 'status', 'cleanup')]
    [string]$Command
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path "$PSScriptRoot/../..").Path
$envFile = Join-Path $repoRoot '.env.deploy'
if (-not (Test-Path -LiteralPath $envFile)) {
    throw '.env.deploy 파일이 필요합니다.'
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $name, $value = $line -split '=', 2
    $values[$name.Trim()] = $value.Trim()
}

$database = $values['DB_NAME']
if ([string]::IsNullOrWhiteSpace($database)) { $database = 'finalcall' }
$required = @('DB_USERNAME', 'DB_PASSWORD', 'SEED_SCENARIO', 'SEED_CONFIRM_TARGET_FINGERPRINT')
foreach ($name in $required) {
    if ([string]::IsNullOrWhiteSpace($values[$name])) { throw "$name 값이 필요합니다." }
}

$scenario = $values['SEED_SCENARIO']
if ($scenario -notin @('ops-20-v1', 'ops-20-v2')) { throw '지원하지 않는 SEED_SCENARIO입니다.' }
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
if ($Command -eq 'apply' -and [string]::IsNullOrWhiteSpace($values['SEED_PASSWORD_HASH'])) {
    throw 'apply에는 SEED_PASSWORD_HASH가 필요합니다.'
}

$names = @('SEED_SCENARIO', 'SEED_CONFIRM_TARGET_FINGERPRINT', 'SEED_CONFIRM_WRITE', 'SEED_ALLOW_PROD',
    'SEED_PASSWORD_HASH')
$previous = @{}
try {
    $previous['SEED_JDBC_URL'] = [Environment]::GetEnvironmentVariable('SEED_JDBC_URL', 'Process')
    $previous['SEED_DB_USERNAME'] = [Environment]::GetEnvironmentVariable('SEED_DB_USERNAME', 'Process')
    $previous['SEED_DB_PASSWORD'] = [Environment]::GetEnvironmentVariable('SEED_DB_PASSWORD', 'Process')
    [Environment]::SetEnvironmentVariable('SEED_JDBC_URL', "jdbc:mysql://mysql:3306/$database", 'Process')
    [Environment]::SetEnvironmentVariable('SEED_DB_USERNAME', $values['DB_USERNAME'], 'Process')
    [Environment]::SetEnvironmentVariable('SEED_DB_PASSWORD', $values['DB_PASSWORD'], 'Process')
    foreach ($name in $names) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
    }
    Write-Host "FinalCall seed 대상: mysql:3306/$database, 명령: $Command"
    docker run --rm --network finalcall-app-network --entrypoint java `
        -e SEED_JDBC_URL -e SEED_DB_USERNAME -e SEED_DB_PASSWORD -e SEED_SCENARIO `
        -e SEED_CONFIRM_TARGET_FINGERPRINT -e SEED_CONFIRM_WRITE -e SEED_ALLOW_PROD -e SEED_PASSWORD_HASH `
        finalcall-backend:local '-Dloader.main=com.finalcall.support.seed.OperationsSeedCli' `
        -cp /app/app.jar org.springframework.boot.loader.launch.PropertiesLauncher $Command
    if ($LASTEXITCODE -ne 0) { throw "시드 컨테이너가 종료 코드 $LASTEXITCODE 로 실패했습니다." }
} finally {
    foreach ($name in @('SEED_JDBC_URL', 'SEED_DB_USERNAME', 'SEED_DB_PASSWORD') + $names) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
}

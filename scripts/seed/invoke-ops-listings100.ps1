param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dry-run', 'apply', 'status', 'cleanup', 'redistribute-skills')]
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
$scenario = 'ops-listings-100-v1'
$fingerprint = "mysql:3306/$database`:$scenario"
if ($values['SEED_SCENARIO'] -ne $scenario) { throw "SEED_SCENARIO=$scenario 설정이 필요합니다." }
if ($values['SEED_CONFIRM_TARGET_FINGERPRINT'] -ne $fingerprint) { throw "대상 fingerprint가 일치하지 않습니다: $fingerprint" }
if ($Command -in @('apply', 'cleanup', 'redistribute-skills')) {
    if ($values['SEED_ALLOW_PROD'] -ne 'true') { throw '쓰기에는 SEED_ALLOW_PROD=true가 필요합니다.' }
    if ($values['SEED_CONFIRM_WRITE'] -ne "$($Command.ToUpperInvariant()):$fingerprint") {
        throw '명령별 SEED_CONFIRM_WRITE가 일치하지 않습니다.'
    }
}

if ($Command -in @('apply', 'redistribute-skills')) {
    $backupScript = Join-Path $PSScriptRoot 'backup-ops-listings100.ps1'
    $backupOutput = & $backupScript
    if ($LASTEXITCODE -ne 0) { throw '사전 백업 검증에 실패했습니다.' }
    $backupContracts = @($backupOutput | Where-Object { "$_" -like 'BACKUP_DIR=*' })
    if ($backupContracts.Count -ne 1) {
        throw "백업 경로 계약은 정확히 한 줄이어야 합니다: count=$($backupContracts.Count)"
    }
    $backupDir = "$($backupContracts[0])".Substring('BACKUP_DIR='.Length)
    $validAbsoluteDirectory = $false
    $hasAbsoluteSyntax = $backupDir -match '^[A-Za-z]:([/]|\\)' -or
        $backupDir -match '^(//|\\\\)[^\\/]'
    if (-not [string]::IsNullOrWhiteSpace($backupDir) -and $hasAbsoluteSyntax -and
        [System.IO.Path]::IsPathRooted($backupDir) -and
        (Test-Path -LiteralPath $backupDir -PathType Container)) {
        try {
            $fullPath = [System.IO.Path]::GetFullPath($backupDir).TrimEnd('\', '/')
            $resolvedPath = (Resolve-Path -LiteralPath $backupDir -ErrorAction Stop)
            $providerPath = $resolvedPath.ProviderPath.TrimEnd('\', '/')
            $validAbsoluteDirectory = $resolvedPath.Provider.Name -eq 'FileSystem' -and
                [System.StringComparer]::OrdinalIgnoreCase.Equals($fullPath, $providerPath)
        } catch {
            $validAbsoluteDirectory = $false
        }
    }
    if (-not $validAbsoluteDirectory) {
        throw '백업 경로가 유효한 절대 디렉터리가 아닙니다.'
    }
    $manifestPath = Join-Path $backupDir 'manifest.txt'
    $dumpPath = Join-Path $backupDir 'before.sql'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $dumpPath -PathType Leaf)) {
        throw '백업 디렉터리에 manifest.txt와 before.sql이 모두 필요합니다.'
    }
    $manifest = Get-Content -LiteralPath $manifestPath
    if ($manifest -notcontains 'restoreVerified=true') { throw '복원 검증된 백업이 아닙니다.' }
    $backupHash = ($manifest | Where-Object { $_ -like 'sha256=*' }) -replace '^sha256=', ''
    if ($backupHash -notmatch '^[0-9A-Fa-f]{64}$') { throw '백업 SHA-256 확인값이 없습니다.' }
}

$names = @('SEED_JDBC_URL', 'SEED_DB_USERNAME', 'SEED_DB_PASSWORD', 'SEED_SCENARIO',
    'SEED_CONFIRM_TARGET_FINGERPRINT', 'SEED_CONFIRM_WRITE', 'SEED_ALLOW_PROD', 'SEED_BACKUP_SHA256',
    'SEED_BACKUP_MANIFEST_PATH')
$previous = @{}
try {
    foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
    [Environment]::SetEnvironmentVariable('SEED_JDBC_URL', "jdbc:mysql://mysql:3306/$database", 'Process')
    [Environment]::SetEnvironmentVariable('SEED_DB_USERNAME', $values['DB_USERNAME'], 'Process')
    [Environment]::SetEnvironmentVariable('SEED_DB_PASSWORD', $values['DB_PASSWORD'], 'Process')
    foreach ($name in @('SEED_SCENARIO', 'SEED_CONFIRM_TARGET_FINGERPRINT', 'SEED_CONFIRM_WRITE', 'SEED_ALLOW_PROD')) {
        [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
    }
    if ($Command -eq 'redistribute-skills') {
        [Environment]::SetEnvironmentVariable('SEED_BACKUP_SHA256', $backupHash, 'Process')
        [Environment]::SetEnvironmentVariable('SEED_BACKUP_MANIFEST_PATH', '/seed-backup/manifest.txt', 'Process')
    }
    $mountArguments = @()
    if ($Command -eq 'redistribute-skills') {
        $mountArguments = @('--mount', "type=bind,source=$backupDir,target=/seed-backup,readonly")
    }
    docker run --rm --network finalcall-app-network @mountArguments --entrypoint java `
        -e SEED_JDBC_URL -e SEED_DB_USERNAME -e SEED_DB_PASSWORD -e SEED_SCENARIO `
        -e SEED_CONFIRM_TARGET_FINGERPRINT -e SEED_CONFIRM_WRITE -e SEED_ALLOW_PROD -e SEED_BACKUP_SHA256 `
        -e SEED_BACKUP_MANIFEST_PATH `
        finalcall-backend:local '-Dloader.main=com.finalcall.support.seed.OperationsSeedCli' `
        -cp /app/app.jar org.springframework.boot.loader.launch.PropertiesLauncher $Command
    if ($LASTEXITCODE -ne 0) { throw "시드 컨테이너가 종료 코드 $LASTEXITCODE 로 실패했습니다." }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}

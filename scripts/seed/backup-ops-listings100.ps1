$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path "$PSScriptRoot/../..").Path
$envFile = Join-Path $repoRoot '.env.deploy'
$values = @{}
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $name, $value = $line -split '=', 2
    $values[$name.Trim()] = $value.Trim()
}
$database = $values['DB_NAME']
if ([string]::IsNullOrWhiteSpace($database)) { $database = 'finalcall' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $repoRoot "backups/seed/$stamp-ops-listings-100-v1"
New-Item -ItemType Directory -Path $backupDir | Out-Null
$dumpPath = Join-Path $backupDir 'before.sql'
$errorPath = Join-Path $backupDir 'mysqldump.stderr.log'
$manifestPath = Join-Path $backupDir 'manifest.txt'
$tables = @('item_instance', 'item_ownership_history', 'auction', 'shop', 'bid', 'money_hold', 'user_balance')
$restoreContainer = "finalcall-seed-restore-$([Guid]::NewGuid().ToString('N'))"
$restoreVolume = "$restoreContainer-data"
$restoreStarted = $false
$restoreVolumeCreated = $false

$previousPassword = [Environment]::GetEnvironmentVariable('MYSQL_PWD', 'Process')
try {
    [Environment]::SetEnvironmentVariable('MYSQL_PWD', $values['DB_PASSWORD'], 'Process')
    $arguments = @('exec', '-e', 'MYSQL_PWD', 'finalcall-deploy-mysql-1', 'mysqldump',
        '--single-transaction', '--quick', '--skip-lock-tables', '--routines', '--events', '--triggers',
        '--set-gtid-purged=OFF', '--no-tablespaces', '--databases', '-u', $values['DB_USERNAME'], $database)
    $process = Start-Process -FilePath 'docker.exe' -ArgumentList $arguments -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput $dumpPath -RedirectStandardError $errorPath
    if ($process.ExitCode -ne 0 -or (Get-Item -LiteralPath $dumpPath).Length -eq 0) {
        throw 'SQL dump 생성에 실패했습니다.'
    }
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $dumpPath).Hash
    $sourceMetadata = @{}
    foreach ($table in $tables) {
        $count = docker exec -e MYSQL_PWD finalcall-deploy-mysql-1 mysql -N -s `
            -u $values['DB_USERNAME'] $database -e "SELECT COUNT(*) FROM $table"
        if ($LASTEXITCODE -ne 0) { throw "$table row count 조회에 실패했습니다." }
        $checksum = docker exec -e MYSQL_PWD finalcall-deploy-mysql-1 mysql -N -s `
            -u $values['DB_USERNAME'] $database -e "CHECKSUM TABLE $table"
        if ($LASTEXITCODE -ne 0) { throw "$table checksum 조회에 실패했습니다." }
        $sourceMetadata["rows.$table"] = "$count".Trim()
        $sourceMetadata["checksum.$table"] = "$checksum" -replace '\s+', ':'
    }

    [Environment]::SetEnvironmentVariable('MYSQL_PWD', $null, 'Process')
    docker volume create $restoreVolume | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '격리 복원용 임시 볼륨 생성에 실패했습니다.' }
    $restoreVolumeCreated = $true
    docker run --detach --rm --name $restoreContainer --mount "type=volume,source=$restoreVolume,target=/var/lib/mysql" `
        -e MYSQL_ALLOW_EMPTY_PASSWORD=yes mysql:8.0 --character-set-server=utf8mb4 `
        --collation-server=utf8mb4_unicode_ci | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '격리 복원용 MySQL 컨테이너 시작에 실패했습니다.' }
    $restoreStarted = $true
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        docker exec $restoreContainer mysqladmin ping --silent 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw '격리 복원용 MySQL이 제한 시간 안에 준비되지 않았습니다.' }
    # 공식 이미지의 초기화용 임시 서버가 먼저 ping에 응답한 뒤 재시작되므로 최종 서버를 다시 확인한다.
    Start-Sleep -Seconds 8
    docker exec $restoreContainer mysqladmin ping --silent 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '격리 복원용 MySQL 최종 서버가 준비되지 않았습니다.' }

    docker cp $dumpPath "$restoreContainer`:/tmp/before.sql" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '격리 컨테이너로 dump 복사에 실패했습니다.' }
    docker exec $restoreContainer mysql --default-character-set=utf8mb4 -u root `
        -e 'SOURCE /tmp/before.sql' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '격리 MySQL 실제 복원에 실패했습니다.' }

    foreach ($table in $tables) {
        $restoredCount = docker exec $restoreContainer mysql -N -s -u root $database `
            -e "SELECT COUNT(*) FROM $table"
        if ($LASTEXITCODE -ne 0) { throw "복원 DB의 $table row count 조회에 실패했습니다." }
        $restoredChecksum = docker exec $restoreContainer mysql -N -s -u root $database `
            -e "CHECKSUM TABLE $table"
        if ($LASTEXITCODE -ne 0) { throw "복원 DB의 $table checksum 조회에 실패했습니다." }
        $normalizedCount = "$restoredCount".Trim()
        $normalizedChecksum = "$restoredChecksum" -replace '\s+', ':'
        if ($normalizedCount -ne $sourceMetadata["rows.$table"] -or
            $normalizedChecksum -ne $sourceMetadata["checksum.$table"]) {
            throw "격리 복원 검증 불일치: $table"
        }
    }

    $metadata = @()
    foreach ($table in $tables) {
        $metadata += "rows.$table=$($sourceMetadata["rows.$table"])"
        $metadata += "checksum.$table=$($sourceMetadata["checksum.$table"])"
    }
    @("fingerprint=mysql:3306/$database`:ops-listings-100-v1", "sha256=$hash",
        "restoreVerified=true", "tables=$($tables -join ',')") + $metadata |
        Set-Content -LiteralPath $manifestPath -Encoding ASCII
} finally {
    [Environment]::SetEnvironmentVariable('MYSQL_PWD', $previousPassword, 'Process')
    if ($restoreStarted -and $restoreContainer -like 'finalcall-seed-restore-*') {
        $savedPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        docker logs $restoreContainer 2>&1 | Set-Content -LiteralPath (Join-Path $backupDir 'restore-mysql.log')
        docker rm --force $restoreContainer 2>$null | Out-Null
        $ErrorActionPreference = $savedPreference
    }
    if ($restoreVolumeCreated -and $restoreVolume -like 'finalcall-seed-restore-*-data') {
        docker volume rm --force $restoreVolume 2>$null | Out-Null
    }
}
$absoluteBackupDir = [System.IO.Path]::GetFullPath($backupDir)
Write-Output "BACKUP_DIR=$absoluteBackupDir"

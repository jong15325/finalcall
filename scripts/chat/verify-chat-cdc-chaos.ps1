[CmdletBinding()]
param(
    [ValidateRange(2, 100)]
    [int]$BatchSize = 6,
    [ValidateRange(30, 600)]
    [int]$TimeoutSeconds = 180,
    [string]$DatabasePassword = 'finalcall'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$composeFile = Join-Path $repoRoot 'backend/docker-compose.local.yml'
$debeziumGrant = Join-Path $repoRoot 'backend/docker/search/mysql/debezium-user.sql'
$topic = 'finalcall.chat.events.v1'
$connector = 'finalcall-chat-outbox-source'
$kafkaContainer = 'finalcall-kafka'
$connectContainer = 'finalcall-chat-kafka-connect'
$mysqlContainer = 'finalcall-mysql'
$createdEventIds = [System.Collections.Generic.List[string]]::new()

function New-TestUlid {
    $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $characters = [char[]]::new(26)
    for ($index = 9; $index -ge 0; $index--) {
        $characters[$index] = $alphabet[[int]($timestamp % 32)]
        $timestamp = [math]::Floor($timestamp / 32)
    }
    $randomBytes = [guid]::NewGuid().ToByteArray()
    for ($index = 10; $index -lt 26; $index++) {
        $characters[$index] = $alphabet[$randomBytes[$index - 10] -band 31]
    }
    return -join $characters
}

$testRoomId = New-TestUlid

function Invoke-Docker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & docker @Arguments 2>&1
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
        throw "docker 명령 실패: docker $($Arguments -join ' ')`n$($output -join "`n")"
    }
    return $output
}

function Invoke-MySql {
    param([Parameter(Mandatory = $true)][string]$Sql)

    $output = Invoke-Docker -Arguments @(
        'exec', '-e', "MYSQL_PWD=$DatabasePassword", $mysqlContainer,
        'mysql', '--batch', '--skip-column-names', '-ufinalcall', 'finalcall', '-e', $Sql)
    return ($output -join "`n").Trim()
}

function Wait-ContainerHealthy {
    param([Parameter(Mandatory = $true)][string]$Container)

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $status = (Invoke-Docker -Arguments @('inspect', '--format', '{{.State.Health.Status}}', $Container) `
                -AllowFailure | Select-Object -Last 1).Trim()
        if ($status -eq 'healthy') {
            return
        }
        Start-Sleep -Seconds 2
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "컨테이너 health가 시간 안에 healthy가 되지 않았습니다: $Container"
}

function Wait-ConnectorRunning {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        try {
            $status = Invoke-RestMethod -Uri "http://localhost:8084/connectors/$connector/status" -TimeoutSec 5
            if ($status.connector.state -eq 'RUNNING' `
                -and @($status.tasks | Where-Object state -ne 'RUNNING').Count -eq 0) {
                return
            }
        } catch {
            # Connect/connector가 재기동 중이면 deadline까지 다시 확인한다.
        }
        Start-Sleep -Seconds 2
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw '채팅 Debezium connector가 시간 안에 RUNNING으로 복구되지 않았습니다.'
}

function Add-OutboxBatch {
    param(
        [Parameter(Mandatory = $true)][int]$StartSequence,
        [Parameter(Mandatory = $true)][string]$FailureWindow
    )

    $batch = [System.Collections.Generic.List[object]]::new()
    for ($index = 0; $index -lt $BatchSize; $index++) {
        $sequence = $StartSequence + $index
        $eventId = New-TestUlid
        $messageId = New-TestUlid
        $payload = @{
            eventId = $eventId
            roomPublicId = $testRoomId
            recipientIds = @(1, 2)
            messagePublicId = $messageId
            roomSequence = $sequence
            senderId = 1
            chaosWindow = $FailureWindow
        } | ConvertTo-Json -Compress
        $payloadBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($payload))
        $sql = @"
INSERT INTO chat_event_outbox
    (event_id, aggregate_type, aggregate_id, event_type, event_version, payload, occurred_at, created_at)
VALUES
    ('$eventId', 'CHAT_ROOM', '$testRoomId', 'MESSAGE_CREATED', 1,
     CAST(CONVERT(FROM_BASE64('$payloadBase64') USING utf8mb4) AS JSON), UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));
"@
        Invoke-MySql -Sql $sql | Out-Null
        $createdEventIds.Add($eventId)
        $batch.Add([pscustomobject]@{ eventId = $eventId; sequence = $sequence })
    }
    return $batch
}

function Read-TestTopic {
    $output = Invoke-Docker -Arguments @(
        'exec', $kafkaContainer,
        '/opt/kafka/bin/kafka-console-consumer.sh',
        '--bootstrap-server', 'localhost:9092',
        '--topic', $topic,
        '--from-beginning',
        '--timeout-ms', '5000') -AllowFailure
    return ($output -join "`n")
}

function Wait-And-AssertEvents {
    param([Parameter(Mandatory = $true)][object[]]$Expected)

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $topicOutput = Read-TestTopic
        $missing = @($Expected | Where-Object {
                $topicOutput.IndexOf($_.eventId, [StringComparison]::Ordinal) -lt 0
            })
        if ($missing.Count -eq 0) {
            $lastPosition = -1
            $duplicates = 0
            foreach ($event in $Expected) {
                $position = $topicOutput.IndexOf($event.eventId, [StringComparison]::Ordinal)
                if ($position -le $lastPosition) {
                    throw "같은 room key의 Kafka event 순서에 gap/역전이 있습니다: sequence=$($event.sequence)"
                }
                $lastPosition = $position
                $count = [regex]::Matches($topicOutput, [regex]::Escape($event.eventId)).Count
                if ($count -gt 1) {
                    $duplicates += $count - 1
                }
            }
            Write-Output "CDC 검증 통과: events=$($Expected.Count), duplicates=$duplicates, gap=0"
            return
        }
        Start-Sleep -Seconds 2
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "CDC backlog가 시간 안에 catch-up되지 않았습니다. missing=$($missing.Count)"
}

function Grant-DebeziumLocalUser {
    $sql = Get-Content -Raw -Encoding UTF8 $debeziumGrant
    $output = $sql | & docker exec -e MYSQL_PWD=root -i $mysqlContainer mysql -uroot 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "로컬 Debezium 계정 권한 적용 실패:`n$($output -join "`n")"
    }
}

try {
    Invoke-Docker -Arguments @(
        'compose', '-f', $composeFile, 'up', '-d', '--build',
        'mysql', 'kafka', 'chat-kafka-topic-init') | Out-Null
    Wait-ContainerHealthy -Container $mysqlContainer
    Wait-ContainerHealthy -Container $kafkaContainer
    Grant-DebeziumLocalUser

    Invoke-Docker -Arguments @(
        'compose', '-f', $composeFile, 'up', '-d', '--build',
        'chat-kafka-connect', 'chat-outbox-connector-init') | Out-Null
    Wait-ContainerHealthy -Container $connectContainer
    Wait-ConnectorRunning

    Write-Output '실제 Connect/Debezium process kill과 backlog catch-up을 검증합니다.'
    Invoke-Docker -Arguments @('kill', $connectContainer) | Out-Null
    $connectBatch = Add-OutboxBatch -StartSequence 1 -FailureWindow 'connect-killed'
    Invoke-Docker -Arguments @('start', $connectContainer) | Out-Null
    Wait-ContainerHealthy -Container $connectContainer
    Wait-ConnectorRunning
    Wait-And-AssertEvents -Expected $connectBatch

    Write-Output '실제 Kafka broker stop/restart와 backlog catch-up을 검증합니다.'
    Invoke-Docker -Arguments @('stop', $kafkaContainer) | Out-Null
    $kafkaBatch = Add-OutboxBatch -StartSequence ($BatchSize + 1) -FailureWindow 'broker-stopped'
    Invoke-Docker -Arguments @('start', $kafkaContainer) | Out-Null
    Wait-ContainerHealthy -Container $kafkaContainer
    Wait-ConnectorRunning
    Wait-And-AssertEvents -Expected @($connectBatch + $kafkaBatch)

    Write-Output '채팅 CDC 실제 장애 검증 전체 통과'
} finally {
    Invoke-Docker -Arguments @('start', $kafkaContainer) -AllowFailure | Out-Null
    Invoke-Docker -Arguments @('start', $connectContainer) -AllowFailure | Out-Null
    if ($createdEventIds.Count -gt 0) {
        $ids = ($createdEventIds | ForEach-Object { "'$_'" }) -join ','
        try {
            Invoke-MySql -Sql "DELETE FROM chat_event_outbox WHERE event_id IN ($ids);" | Out-Null
        } catch {
            Write-Warning 'chaos outbox fixture 정리에 실패했습니다. eventId 목록은 로그에 출력하지 않습니다.'
        }
    }
}

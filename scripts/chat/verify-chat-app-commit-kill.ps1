[CmdletBinding(DefaultParameterSetName = 'Process')]
param(
    [Parameter(Mandatory = $true)]
    [string]$FixturePath,
    [Parameter(Mandatory = $true, ParameterSetName = 'Process')]
    [ValidateRange(1, 2147483647)]
    [int]$AppProcessId,
    [Parameter(Mandatory = $true, ParameterSetName = 'Container')]
    [string]$AppContainer,
    [string]$BaseUrl = 'http://localhost:8080',
    [string]$GatewayToken = $env:CHAT_GATEWAY_TOKEN,
    [string]$DatabasePassword = 'finalcall',
    [ValidateRange(10, 300)]
    [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
if (-not (Test-Path -LiteralPath $FixturePath -PathType Leaf)) {
    throw "fixture 파일을 찾지 못했습니다: $FixturePath"
}

$fixtures = Get-Content -Raw -Encoding UTF8 -LiteralPath $FixturePath | ConvertFrom-Json
$sender = @($fixtures.users)[0]
$roomPublicId = @($sender.roomPublicIds)[0]
if ([string]::IsNullOrWhiteSpace($sender.accessToken) -or [string]::IsNullOrWhiteSpace($roomPublicId)) {
    throw '첫 fixture user에는 accessToken과 roomPublicIds가 필요합니다.'
}

$clientMessageId = [guid]::NewGuid().ToString()
$appTargetKind = $PSCmdlet.ParameterSetName
$mysqlContainer = 'finalcall-mysql'
$kafkaContainer = 'finalcall-kafka'
$topic = 'finalcall.chat.events.v1'

function Invoke-MySql {
    param([Parameter(Mandatory = $true)][string]$Sql)

    $output = & docker exec -e "MYSQL_PWD=$DatabasePassword" $mysqlContainer `
        mysql --batch --skip-column-names -ufinalcall finalcall -e $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL 검증 query 실패:`n$($output -join "`n")"
    }
    return ($output -join "`n").Trim()
}

function Stop-AppImmediately {
    if ($appTargetKind -eq 'Container') {
        $running = (& docker inspect --format '{{.State.Running}}' $AppContainer 2>$null | Select-Object -Last 1).Trim()
        if ($LASTEXITCODE -ne 0 -or $running -ne 'true') {
            throw "실행 중인 app container가 아닙니다: $AppContainer"
        }
        & docker kill $AppContainer | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "app container kill 실패: $AppContainer"
        }
        return
    }

    $process = Get-Process -Id $AppProcessId -ErrorAction Stop
    if ($process.HasExited) {
        throw "이미 종료된 app process입니다: $AppProcessId"
    }
    Stop-Process -Id $AppProcessId -Force
}

function Wait-KafkaEvent {
    param([Parameter(Mandatory = $true)][string]$EventId)

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $previousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $output = & docker exec $kafkaContainer /opt/kafka/bin/kafka-console-consumer.sh `
                --bootstrap-server localhost:9092 --topic $topic --from-beginning --timeout-ms 3000 2>&1
        } finally {
            $ErrorActionPreference = $previousErrorAction
        }
        $text = $output -join "`n"
        if ($text.IndexOf($EventId, [StringComparison]::Ordinal) -ge 0) {
            return
        }
        Start-Sleep -Seconds 1
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw 'app kill 뒤 committed outbox event가 Kafka에서 발견되지 않았습니다.'
}

$headers = @{
    Authorization = "Bearer $($sender.accessToken)"
}
if (-not [string]::IsNullOrWhiteSpace($GatewayToken)) {
    $headers['X-Gateway-Token'] = $GatewayToken
}
$body = @{
    clientMessageId = $clientMessageId
    body = "FC-327 commit-kill $([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
} | ConvertTo-Json -Compress

$httpClient = [System.Net.Http.HttpClient]::new()
try {
    foreach ($header in $headers.GetEnumerator()) {
        $httpClient.DefaultRequestHeaders.TryAddWithoutValidation($header.Key, $header.Value) | Out-Null
    }
    $content = [System.Net.Http.StringContent]::new($body, [System.Text.Encoding]::UTF8, 'application/json')
    $postTask = $httpClient.PostAsync(
        "$BaseUrl/api/v1/me/chat-rooms/$([uri]::EscapeDataString($roomPublicId))/messages", $content)

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    $committed = $null
    do {
        $sql = @"
SELECT CONCAT(m.public_id, '|', m.room_sequence, '|', o.event_id)
FROM chat_message m
JOIN chat_room r ON r.id = m.room_id
JOIN chat_event_outbox o
  ON JSON_UNQUOTE(JSON_EXTRACT(o.payload, '$.messagePublicId')) = m.public_id
WHERE r.public_id = '$roomPublicId'
  AND m.client_message_id = '$clientMessageId'
LIMIT 1;
"@
        $committed = Invoke-MySql -Sql $sql
        if (-not [string]::IsNullOrWhiteSpace($committed)) {
            break
        }
        Start-Sleep -Milliseconds 20
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    if ([string]::IsNullOrWhiteSpace($committed)) {
        throw 'HTTP 요청 중 DB commit을 시간 안에 관측하지 못했습니다.'
    }

    Stop-AppImmediately
    try {
        $postTask.GetAwaiter().GetResult() | Out-Null
    } catch {
        # commit 직후 process kill이면 HTTP 응답이 끊기는 것이 정상이다.
    }

    $parts = $committed.Split('|')
    $messagePublicId = $parts[0]
    $roomSequence = [long]$parts[1]
    $eventId = $parts[2]
    $rowCount = Invoke-MySql -Sql @"
SELECT COUNT(*)
FROM chat_message m
JOIN chat_room r ON r.id = m.room_id
WHERE r.public_id = '$roomPublicId'
  AND m.client_message_id = '$clientMessageId'
  AND m.public_id = '$messagePublicId';
"@
    if ([long]$rowCount -ne 1L) {
        throw "commit-kill 뒤 메시지 멱등 row 수가 1이 아닙니다: $rowCount"
    }
    Wait-KafkaEvent -EventId $eventId
    Write-Output "commit 직후 app kill 복구 검증 통과: row=1, sequence=$roomSequence, CDC=no-loss"
} finally {
    $httpClient.Dispose()
}

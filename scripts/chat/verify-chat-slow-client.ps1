[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FixturePath,
    [ValidateRange(550, 5000)]
    [int]$MessageCount = 700,
    [string]$GatewayToken = $env:CHAT_GATEWAY_TOKEN,
    [string]$DatabasePassword = 'finalcall',
    [ValidateRange(1, 65535)]
    [int]$AppPort = 8080,
    [ValidateRange(1, 65535)]
    [int]$ToxiproxyApiPort = 18474,
    [ValidateRange(1, 65535)]
    [int]$SlowProxyPort = 18080,
    [ValidateRange(30, 180)]
    [int]$SocketDurationSeconds = 60
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $FixturePath -PathType Leaf)) {
    throw "fixture 파일을 찾지 못했습니다: $FixturePath"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$fixtures = Get-Content -Raw -Encoding UTF8 -LiteralPath $FixturePath | ConvertFrom-Json
$fixtureUser = @($fixtures.users)[0]
$roomPublicId = @($fixtureUser.roomPublicIds)[0]
if ([string]::IsNullOrWhiteSpace($fixtureUser.accessToken) -or [string]::IsNullOrWhiteSpace($roomPublicId)) {
    throw '첫 fixture user에는 accessToken과 roomPublicIds가 필요합니다.'
}

$runId = [guid]::NewGuid().ToString('N')
$toxiproxyContainer = "finalcall-chat-toxiproxy-$runId"
$healthyContainer = "finalcall-chat-healthy-$runId"
$slowContainer = "finalcall-chat-slow-$runId"
$tempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "finalcall-chat-$runId"
$fixtureCopy = Join-Path $tempDirectory 'fixture.json'
$healthyOutput = Join-Path $tempDirectory 'healthy'
$slowOutput = Join-Path $tempDirectory 'slow'
$mysqlContainer = 'finalcall-mysql'
$redisContainer = 'finalcall-redis'
$channel = 'finalcall:chat:fanout:v1'
$createdRows = [System.Collections.Generic.List[object]]::new()

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

function Invoke-MySql {
    param([Parameter(Mandatory = $true)][string]$Sql)

    $output = & docker exec -e "MYSQL_PWD=$DatabasePassword" $mysqlContainer `
        mysql --batch --skip-column-names -ufinalcall finalcall -e $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL slow-client fixture query 실패:`n$($output -join "`n")"
    }
    return ($output -join "`n").Trim()
}

function Start-K6Socket {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$WebSocketUrl,
        [Parameter(Mandatory = $true)][string]$OutputDirectory
    )

    $arguments = @(
        'run', '-d', '--name', $Name,
        '--add-host', 'host.docker.internal:host-gateway',
        '-v', "$($repoRoot.Replace('\', '/'))/scripts/chat:/scripts:ro",
        '-v', "$($fixtureCopy.Replace('\', '/')):/fixtures.json:ro",
        '-v', "$($OutputDirectory.Replace('\', '/')):/output",
        '-e', 'CHAT_FIXTURE_FILE=/fixtures.json',
        '-e', "CHAT_GATEWAY_TOKEN=$GatewayToken",
        '-e', 'CHAT_MODE=socket-once',
        '-e', 'CHAT_SOCKET_VUS=1',
        '-e', 'CHAT_SOCKETS_PER_USER=1',
        '-e', "CHAT_SOCKET_DURATION=${SocketDurationSeconds}s",
        '-e', "CHAT_SOCKET_HOLD=${SocketDurationSeconds}s",
        '-e', "CHAT_WS_URL=$WebSocketUrl",
        'grafana/k6:0.57.0',
        'run', '--summary-export', '/output/summary.json', '/scripts/k6-chat-load.js')
    & docker @arguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "k6 socket container 시작 실패: $Name"
    }
}

function Add-MessageFixtures {
    $room = Invoke-MySql -Sql @"
SELECT CONCAT(r.id, '|', r.member_low_id, '|', r.member_high_id, '|', r.last_sequence, '|', u.nickname)
FROM chat_room r
JOIN user u ON u.id = r.member_low_id
WHERE r.public_id = '$roomPublicId';
"@
    if ([string]::IsNullOrWhiteSpace($room)) {
        throw "fixture room을 DB에서 찾지 못했습니다: $roomPublicId"
    }
    $parts = $room.Split('|')
    $roomId = [long]$parts[0]
    $memberLowId = [long]$parts[1]
    $memberHighId = [long]$parts[2]
    $initialSequence = [long]$parts[3]
    $senderNickname = $parts[4].Replace("'", "''")
    $body = ('가' * 980)

    for ($offset = 0; $offset -lt $MessageCount; $offset += 10) {
        $values = [System.Collections.Generic.List[string]]::new()
        $batchEnd = [math]::Min($offset + 10, $MessageCount)
        for ($index = $offset; $index -lt $batchEnd; $index++) {
            $sequence = $initialSequence + $index + 1
            $messageId = New-TestUlid
            $eventId = New-TestUlid
            $clientMessageId = [guid]::NewGuid().ToString()
            $values.Add("('$messageId',$roomId,$sequence,$memberLowId,'$senderNickname'," +
                "'$clientMessageId','$body',UTC_TIMESTAMP(6))")
            $createdRows.Add([pscustomobject]@{
                    messageId = $messageId
                    eventId = $eventId
                    sequence = $sequence
                    senderId = $memberLowId
                    recipients = @($memberLowId, $memberHighId)
                })
        }
        $sql = @"
INSERT INTO chat_message
    (public_id, room_id, room_sequence, sender_id, sender_nickname_snapshot, client_message_id, body, created_at)
VALUES $($values -join ',');
"@
        Invoke-MySql -Sql $sql | Out-Null
    }
    $lastSequence = $initialSequence + $MessageCount
    Invoke-MySql -Sql @"
UPDATE chat_room
SET last_sequence = $lastSequence, last_activity_at = UTC_TIMESTAMP(6), updated_at = UTC_TIMESTAMP(6)
WHERE id = $roomId;
"@ | Out-Null
}

function Publish-Fixtures {
    $commands = [System.Collections.Generic.List[string]]::new()
    foreach ($row in $createdRows) {
        $metadata = @{
            eventId = $row.eventId
            eventType = 'MESSAGE_CREATED'
            eventVersion = 1
            occurredAt = [DateTimeOffset]::UtcNow.ToString('o')
            roomPublicId = $roomPublicId
            recipientIds = $row.recipients
            messagePublicId = $row.messageId
            roomSequence = $row.sequence
            senderId = $row.senderId
        } | ConvertTo-Json -Compress
        $commands.Add("PUBLISH $channel '$metadata'")
    }
    $output = ($commands -join "`n") | & docker exec -i $redisContainer redis-cli 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Redis fan-out fixture publish 실패:`n$($output -join "`n")"
    }
}

function Get-SendBufferExceededCount {
    $metrics = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$AppPort/actuator/prometheus" -TimeoutSec 10
    $match = [regex]::Match($metrics.Content, '(?m)^chat_websocket_send_buffer_exceeded_total(?:\{[^}]*\})?\s+([0-9.eE+-]+)$')
    if (-not $match.Success) {
        throw 'chat.websocket.send.buffer.exceeded metric이 노출되지 않았습니다.'
    }
    return [double]::Parse($match.Groups[1].Value, [Globalization.CultureInfo]::InvariantCulture)
}

function Assert-SendBufferExceeded {
    param([Parameter(Mandatory = $true)][double]$Before)

    $after = Get-SendBufferExceededCount
    if (($after - $Before) -lt 1.0) {
        throw "이번 slow-client 검증에서 send buffer 초과가 증가하지 않았습니다: before=$Before, after=$after"
    }
}

function Assert-HealthySession {
    $summaryPath = Join-Path $healthyOutput 'summary.json'
    if (-not (Test-Path -LiteralPath $summaryPath)) {
        throw '정상 session k6 summary가 생성되지 않았습니다.'
    }
    $summary = Get-Content -Raw -Encoding UTF8 $summaryPath | ConvertFrom-Json
    $received = [double]$summary.metrics.chat_websocket_events.values.count
    if ($received -lt $MessageCount) {
        throw "slow session과 분리된 정상 session이 모든 event를 받지 못했습니다: $received/$MessageCount"
    }
    $rowCount = [long](Invoke-MySql -Sql @"
SELECT COUNT(*) FROM chat_message WHERE public_id IN ($(
    ($createdRows | ForEach-Object { "'$($_.messageId)'" }) -join ','));
"@)
    if ($rowCount -ne $MessageCount) {
        throw "slow session 종료가 DB fixture에 영향을 줬습니다: $rowCount/$MessageCount"
    }
}

function Assert-SlowSessionClosed {
    $summaryPath = Join-Path $slowOutput 'summary.json'
    if (-not (Test-Path -LiteralPath $summaryPath)) {
        throw '느린 session k6 summary가 생성되지 않았습니다.'
    }
    $summary = Get-Content -Raw -Encoding UTF8 $summaryPath | ConvertFrom-Json
    $remoteCloses = [double]$summary.metrics.chat_websocket_remote_closes.values.count
    $received = [double]$summary.metrics.chat_websocket_events.values.count
    if ($remoteCloses -lt 1) {
        throw '느린 session이 server 쪽에서 종료되지 않았습니다.'
    }
    if ($received -ge $MessageCount) {
        throw "느린 session이 buffer 제한 전에 모든 event를 받아 격리 조건이 성립하지 않았습니다: $received"
    }
}

try {
    [System.IO.Directory]::CreateDirectory($healthyOutput) | Out-Null
    [System.IO.Directory]::CreateDirectory($slowOutput) | Out-Null
    $singleFixture = @{ users = @($fixtureUser) } | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($fixtureCopy, $singleFixture, [System.Text.UTF8Encoding]::new($false))
    $sendBufferExceededBefore = Get-SendBufferExceededCount

    & docker run -d --rm --name $toxiproxyContainer `
        --add-host host.docker.internal:host-gateway `
        -p "${ToxiproxyApiPort}:8474" -p "${SlowProxyPort}:18080" ghcr.io/shopify/toxiproxy:2.12.0 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Toxiproxy container 시작 실패'
    }
    Start-Sleep -Seconds 2
    Invoke-RestMethod -Method Post -Uri "http://localhost:$ToxiproxyApiPort/proxies" -ContentType 'application/json' `
        -Body (@{ name = 'chat-slow'; listen = '0.0.0.0:18080'; upstream = "host.docker.internal:$AppPort" } |
            ConvertTo-Json -Compress) | Out-Null
    Invoke-RestMethod -Method Post -Uri "http://localhost:$ToxiproxyApiPort/proxies/chat-slow/toxics" `
        -ContentType 'application/json' -Body (@{
            name = 'slow-downstream'
            type = 'bandwidth'
            stream = 'downstream'
            toxicity = 1.0
            attributes = @{ rate = 1 }
        } | ConvertTo-Json -Depth 4 -Compress) | Out-Null

    Start-K6Socket -Name $healthyContainer -WebSocketUrl "ws://host.docker.internal:$AppPort/ws/chat" `
        -OutputDirectory $healthyOutput
    Start-K6Socket -Name $slowContainer -WebSocketUrl "ws://host.docker.internal:$SlowProxyPort/ws/chat" `
        -OutputDirectory $slowOutput
    Start-Sleep -Seconds 5

    Add-MessageFixtures
    Publish-Fixtures
    Start-Sleep -Seconds 15
    Assert-SendBufferExceeded -Before $sendBufferExceededBefore

    & docker wait $healthyContainer | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw '정상 session k6 container가 비정상 종료했습니다.'
    }
    & docker wait $slowContainer | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw '느린 session k6 container가 비정상 종료했습니다.'
    }
    Assert-HealthySession
    Assert-SlowSessionClosed
    Write-Output "slow-client 격리 검증 통과: slow=buffer-closed, healthy=$MessageCount, db=$MessageCount"
} finally {
    foreach ($container in @($healthyContainer, $slowContainer, $toxiproxyContainer)) {
        $previousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & docker container inspect $container 2>$null | Out-Null
        $containerExists = $LASTEXITCODE -eq 0
        $ErrorActionPreference = $previousErrorAction
        if ($containerExists) {
            & docker rm -f $container | Out-Null
        }
    }
    if (Test-Path -LiteralPath $tempDirectory) {
        Remove-Item -LiteralPath $tempDirectory -Recurse -Force
    }
}

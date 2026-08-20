[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('redis', 'kafka', 'connect', 'node')]
    [string]$Target,
    [ValidateRange(1, 600)]
    [int]$Seconds = 30,
    [string]$NodeContainer = ''
)

$ErrorActionPreference = 'Stop'
$container = switch ($Target) {
    'redis' { 'finalcall-redis' }
    'kafka' { 'finalcall-kafka' }
    'connect' { 'finalcall-chat-kafka-connect' }
    'node' {
        if ([string]::IsNullOrWhiteSpace($NodeContainer)) {
            throw 'Target=node이면 -NodeContainer를 지정해야 합니다.'
        }
        $NodeContainer
    }
}

$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    $running = docker inspect --format '{{.State.Running}}' $container 2>$null
} finally {
    $ErrorActionPreference = $previousErrorAction
}
if ($LASTEXITCODE -ne 0 -or $running -ne 'true') {
    throw "실행 중인 컨테이너를 찾지 못했습니다: $container"
}

if ($Target -eq 'node') {
    docker restart $container | Out-Null
    Write-Output "노드를 재시작했습니다: $container"
    exit 0
}

docker pause $container | Out-Null
Write-Output "$container 중단 시작: ${Seconds}초."
try {
    Start-Sleep -Seconds $Seconds
} finally {
    docker unpause $container | Out-Null
    Write-Output "$container 복구 완료."
}

[CmdletBinding()]
param(
    [ValidateRange(2, 20000)]
    [int]$UserCount = 100,
    [string]$BaseUrl = 'http://localhost:8080',
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [long]$ExistingRunId = 0,
    [string]$GatewayToken = $env:CHAT_GATEWAY_TOKEN,
    [string]$Password = $env:CHAT_LOAD_PASSWORD
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Password)) {
    throw 'CHAT_LOAD_PASSWORD 환경변수나 -Password를 지정해야 합니다.'
}
if (Test-Path -LiteralPath $OutputPath) {
    throw "기존 fixture를 덮어쓰지 않습니다: $OutputPath"
}

$headers = @{}
if (-not [string]::IsNullOrWhiteSpace($GatewayToken)) {
    $headers['X-Gateway-Token'] = $GatewayToken
}
$runId = if ($ExistingRunId -gt 0) {
    $ExistingRunId
} else {
    [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
}
$users = [System.Collections.Generic.List[object]]::new()

function ConvertTo-ClientIp {
    param([Parameter(Mandatory = $true)][int]$Index)

    $second = [math]::Floor($Index / (254 * 254))
    $third = [math]::Floor($Index / 254) % 254
    $fourth = ($Index % 254) + 1
    return "10.$second.$third.$fourth"
}

function New-RequestHeaders {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ClientIp,
        [string]$Authorization = ''
    )

    $requestHeaders = @{}
    foreach ($key in $headers.Keys) {
        $requestHeaders[$key] = $headers[$key]
    }
    $requestHeaders['X-Forwarded-For'] = $ClientIp
    if (-not [string]::IsNullOrWhiteSpace($Authorization)) {
        $requestHeaders['Authorization'] = $Authorization
    }
    return $requestHeaders
}

for ($index = 0; $index -lt $UserCount; $index++) {
    $loginId = "chatload_${runId}_$index"
    $nickname = "load${runId}_$index"
    $clientIp = ConvertTo-ClientIp -Index $index
    $requestHeaders = New-RequestHeaders -ClientIp $clientIp
    if ($ExistingRunId -eq 0) {
        $signup = @{ loginId = $loginId; password = $Password; nickname = $nickname } | ConvertTo-Json
        Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/signup" -Headers $requestHeaders `
            -ContentType 'application/json' -Body $signup | Out-Null
    }
    $login = @{ loginId = $loginId; password = $Password } | ConvertTo-Json
    $response = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" -Headers $requestHeaders `
        -ContentType 'application/json' -Body $login
    $users.Add([pscustomobject]@{
        nickname = $nickname
        accessToken = $response.data.accessToken
        roomPublicIds = [System.Collections.Generic.List[string]]::new()
        clientIp = $clientIp
    })
}

for ($index = 0; $index -lt $users.Count; $index += 2) {
    $counterpartIndex = if ($index + 1 -lt $users.Count) { $index + 1 } else { 0 }
    $roomHeaders = New-RequestHeaders -ClientIp $users[$index].clientIp `
        -Authorization "Bearer $($users[$index].accessToken)"
    $body = @{ counterpartNickname = $users[$counterpartIndex].nickname } | ConvertTo-Json
    $room = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/me/chat-rooms/direct" `
        -Headers $roomHeaders -ContentType 'application/json' -Body $body
    $roomPublicId = $room.data.roomPublicId
    $users[$index].roomPublicIds.Add($roomPublicId)
    $users[$counterpartIndex].roomPublicIds.Add($roomPublicId)
}

$parent = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($parent)) {
    [System.IO.Directory]::CreateDirectory($parent) | Out-Null
}
$json = @{ users = $users } | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Output "fixture 생성 완료: users=$($users.Count), path=$OutputPath"

[CmdletBinding()]
param(
    [ValidateRange(1, 20000)]
    [int]$UserCount = 6667,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [ValidateRange(1, 24)]
    [int]$ExpiresInHours = 2,
    [long]$SubjectBase = 900000000000,
    [string]$JwtSecret = $env:CHAT_JWT_SECRET
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($JwtSecret)) {
    throw 'CHAT_JWT_SECRET 환경변수나 -JwtSecret을 지정해야 합니다.'
}
if ([System.Text.Encoding]::UTF8.GetByteCount($JwtSecret) -lt 32) {
    throw 'HS256 fixture secret은 UTF-8 32바이트 이상이어야 합니다.'
}
if (Test-Path -LiteralPath $OutputPath) {
    throw "기존 fixture를 덮어쓰지 않습니다: $OutputPath"
}

function ConvertTo-Base64Url {
    param([Parameter(Mandatory = $true)][byte[]]$Bytes)

    return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function ConvertTo-ClientIp {
    param([Parameter(Mandatory = $true)][int]$Index)

    $second = [math]::Floor($Index / (254 * 254))
    $third = [math]::Floor($Index / 254) % 254
    $fourth = ($Index % 254) + 1
    return "10.$second.$third.$fourth"
}

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$expiresAt = $now + ($ExpiresInHours * 60 * 60)
$headerJson = @{ alg = 'HS256'; typ = 'JWT' } | ConvertTo-Json -Compress
$header = ConvertTo-Base64Url -Bytes ([System.Text.Encoding]::UTF8.GetBytes($headerJson))
$secretBytes = [System.Text.Encoding]::UTF8.GetBytes($JwtSecret)
$users = [System.Collections.Generic.List[object]]::new($UserCount)

for ($index = 0; $index -lt $UserCount; $index++) {
    $subject = [string]($SubjectBase + $index)
    $payloadJson = [ordered]@{
        sub = $subject
        publicId = "socket-load-$subject"
        isAdmin = $false
        iat = $now
        exp = $expiresAt
    } | ConvertTo-Json -Compress
    $payload = ConvertTo-Base64Url -Bytes ([System.Text.Encoding]::UTF8.GetBytes($payloadJson))
    $unsignedToken = "$header.$payload"
    $hmac = [System.Security.Cryptography.HMACSHA256]::new($secretBytes)
    try {
        $signatureBytes = $hmac.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($unsignedToken))
    } finally {
        $hmac.Dispose()
    }
    $signature = ConvertTo-Base64Url -Bytes $signatureBytes
    $users.Add([pscustomobject]@{
            accessToken = "$unsignedToken.$signature"
            roomPublicIds = @()
            clientIp = ConvertTo-ClientIp -Index $index
        })
}

$parent = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($parent)) {
    [System.IO.Directory]::CreateDirectory($parent) | Out-Null
}
$json = @{ users = $users } | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Output "socket fixture 생성 완료: users=$UserCount, expiresAt=$expiresAt, path=$OutputPath"

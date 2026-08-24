$targets = @(
    @{ Name = 'frontend'; Uri = 'http://127.0.0.1:23000' },
    @{ Name = 'gateway'; Uri = 'http://127.0.0.1:28080/actuator/health' },
    @{ Name = 'backend'; Uri = 'http://127.0.0.1:28081/actuator/health' }
)

foreach ($target in $targets) {
    try {
        $response = Invoke-WebRequest -Uri $target.Uri -UseBasicParsing -TimeoutSec 3
        Write-Host ("{0,-10} UP ({1})" -f $target.Name, $response.StatusCode)
    } catch {
        Write-Host ("{0,-10} DOWN" -f $target.Name)
    }
}

docker ps --filter 'name=finalcall-' --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'

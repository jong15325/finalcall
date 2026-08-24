param([ValidateSet('dry-run', 'apply')] [string]$Command = 'dry-run')
& "$PSScriptRoot/invoke-ops20.ps1" -Command $Command

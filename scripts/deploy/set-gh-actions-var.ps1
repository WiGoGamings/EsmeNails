param(
  [Parameter(Mandatory = $true)]
  [string]$GitHubToken,

  [Parameter(Mandatory = $true)]
  [string]$ApiBaseUrl,

  [string]$Owner = "WiGoGamings",
  [string]$Repo = "EsmeNails",
  [string]$VarName = "VITE_API_URL"
)

$trimmed = $ApiBaseUrl.Trim().TrimEnd("/")
if (-not $trimmed.EndsWith("/api")) {
  $trimmed = "$trimmed/api"
}

$uri = "https://api.github.com/repos/$Owner/$Repo/actions/variables/$VarName"
$headers = @{
  Authorization = "Bearer $GitHubToken"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}
$payload = @{
  name = $VarName
  value = $trimmed
} | ConvertTo-Json

try {
  Invoke-RestMethod -Method Patch -Uri $uri -Headers $headers -Body $payload -ContentType "application/json" | Out-Null
  Write-Output "Updated variable $VarName=$trimmed"
} catch {
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 404) {
    $createUri = "https://api.github.com/repos/$Owner/$Repo/actions/variables"
    Invoke-RestMethod -Method Post -Uri $createUri -Headers $headers -Body $payload -ContentType "application/json" | Out-Null
    Write-Output "Created variable $VarName=$trimmed"
  } else {
    throw
  }
}

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("jerin", "toshi", "status")]
    [string]$Member = "status"
)

if ($Member -eq "jerin") {
    git config --local user.name "Israt Jerin"
    git config --local user.email "nafijerin455@gmail.com"
    Write-Host "[OK] Active Git Author set to: Israt Jerin <nafijerin455@gmail.com>" -ForegroundColor Green
}
elseif ($Member -eq "toshi") {
    git config --local user.name "Tasmin Toshi"
    git config --local user.email "toshi2305341342@diu.edu.bd"
    Write-Host "[OK] Active Git Author set to: Tasmin Toshi <toshi2305341342@diu.edu.bd>" -ForegroundColor Cyan
}
else {
    $currentName = git config --local user.name
    $currentEmail = git config --local user.email
    Write-Host "Current Active Contributor on this PC: $currentName <$currentEmail>" -ForegroundColor Yellow
}

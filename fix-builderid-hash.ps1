# 修正所有 BuilderId 账号的 clientIdHash

$accountsPath = "$env:APPDATA\.kiro-account-manager\accounts.json"
$correctHash = "e909a0580879b06ece1202964fbe9dda95ea4ce3"

# 读取账号数据
$accounts = Get-Content $accountsPath -Raw | ConvertFrom-Json

# 统计
$total = 0
$fixed = 0

foreach ($account in $accounts) {
    if ($account.provider -eq 'BuilderId') {
        $total++
        if ($account.clientIdHash -ne $correctHash) {
            Write-Host "修正: $($account.email)"
            Write-Host "  旧值: $($account.clientIdHash)"
            Write-Host "  新值: $correctHash"
            $account.clientIdHash = $correctHash
            $fixed++
        }
    }
}

# 保存
$accounts | ConvertTo-Json -Depth 10 | Set-Content $accountsPath -Encoding UTF8

Write-Host ""
Write-Host "修正完成！"
Write-Host "总计 BuilderId 账号: $total"
Write-Host "已修正: $fixed"
Write-Host "无需修正: $($total - $fixed)"

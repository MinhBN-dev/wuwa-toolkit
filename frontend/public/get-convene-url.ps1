# Echoes Optimizer — Wuthering Waves Convene URL extractor (Oversea)
# Reads Client.log from common install paths + registry, extracts the gacha
# history URL, and copies it to clipboard. Run in Windows PowerShell after you
# open Convene → History in-game (so the log contains a fresh URL).

$ErrorActionPreference = 'SilentlyContinue'

function Find-GamePath {
    # 1. Uninstall registry (32 + 64 bit)
    $regKeys = @(
        "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    $reg = Get-ItemProperty -Path $regKeys |
        Where-Object { $_.DisplayName -like '*wuthering*' } |
        Select-Object -First 1 -ExpandProperty InstallPath
    if ($reg -and (Test-Path "$reg\Client\Saved\Logs\Client.log")) { return $reg }

    # 2. Firewall rules (game must have been launched once)
    $fwPath = 'Registry::HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\FirewallRules'
    $fw = (Get-ItemProperty -Path $fwPath).PSObject.Properties |
        Where-Object { $_.Value -like '*wuthering*' -and $_.Name -like '*client-win64-shipping*' } |
        Select-Object -First 1
    if ($fw) {
        $p = (($fw.Value -split 'App=')[1] -split '\\client\\')[0]
        if (Test-Path "$p\Client\Saved\Logs\Client.log") { return $p }
    }

    # 3. Common install paths across all drives
    $candidates = @()
    foreach ($d in (Get-PSDrive -PSProvider FileSystem).Name) {
        $candidates += @(
            "$d`:\Wuthering Waves Game",
            "$d`:\Wuthering Waves\Wuthering Waves Game",
            "$d`:\Program Files\Wuthering Waves\Wuthering Waves Game",
            "$d`:\Program Files (x86)\Steam\steamapps\common\Wuthering Waves\Wuthering Waves Game",
            "$d`:\Program Files\Epic Games\WutheringWavesj3oFh\Wuthering Waves Game"
        )
    }
    foreach ($p in $candidates) {
        if (Test-Path "$p\Client\Saved\Logs\Client.log") { return $p }
    }

    return $null
}

$gamePath = Find-GamePath
if (-not $gamePath) {
    $manual = Read-Host "Auto-detect failed. Paste your full game install path (the folder containing 'Wuthering Waves Game')"
    if ($manual -and (Test-Path "$manual\Client\Saved\Logs\Client.log")) {
        $gamePath = $manual
    } else {
        Write-Host "Client.log not found at provided path. Aborting." -ForegroundColor Red
        return
    }
}

$log = "$gamePath\Client\Saved\Logs\Client.log"
$debugLog = "$gamePath\Client\Binaries\Win64\ThirdParty\KrPcSdk_Global\KRSDKRes\KRSDKWebView\debug.log"

$pattern = 'https://aki-gm-resources-oversea\.aki-game\.(net|com)/aki/gacha/index\.html#/record\?[^\s"]*'
$url = $null

if (Test-Path $log) {
    $hit = Get-Content $log | Select-String -Pattern $pattern | Select-Object -Last 1
    if ($hit) { $url = $hit.Matches[0].Value }
}
if (-not $url -and (Test-Path $debugLog)) {
    $hit = Get-Content $debugLog | Select-String -Pattern $pattern | Select-Object -Last 1
    if ($hit) { $url = $hit.Matches[0].Value }
}

if ($url) {
    Set-Clipboard -Value $url
    Write-Host ""
    Write-Host "Convene URL copied to clipboard:" -ForegroundColor Green
    Write-Host $url -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Now paste it into the Convene tracker page in Echoes Optimizer." -ForegroundColor Cyan
} else {
    Write-Host "No Convene URL found in logs. Open Convene > History in-game first, then re-run." -ForegroundColor Red
}

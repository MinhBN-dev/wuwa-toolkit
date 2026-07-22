# Wuwa Toolkit — Wuthering Waves Convene URL extractor (Oversea)
# Reads the game's Client.log, extracts the gacha history URL, copies it to the
# clipboard. Run in Windows PowerShell AFTER opening Convene -> History in-game.
#
# NOTE: Kuro XOR-obfuscates Client.log (a byte whose low nibble is odd is XOR'd
# with 0xA5, otherwise 0xEF). We must de-obfuscate before searching, or the URL is
# invisible. Files are opened with a shared handle so this works while the game runs.
# De-obfuscation scheme credit: wuwatracker / @RabbyDevs / @kyuxu.

$ErrorActionPreference = 'SilentlyContinue'

# --- Manual override -------------------------------------------------------
# Folder containing "Wuthering Waves Game" (or the game folder itself). Pre-filled
# for this machine's Steam install so you're never prompted. Blank ('') = auto only.
$GamePathOverride = 'D:\Games\Steam\steamapps\common\Wuthering Waves'
# ---------------------------------------------------------------------------

function Resolve-GameRoot {
    param([string]$Base)
    if (-not $Base) { return $null }
    foreach ($p in @($Base, (Join-Path $Base 'Wuthering Waves Game'))) {
        if (Test-Path (Join-Path $p 'Client\Saved\Logs')) { return $p }
    }
    return $null
}

function Find-GamePath {
    $r = Resolve-GameRoot $GamePathOverride
    if ($r) { return $r }

    # MUI cache — the exe the shell actually launched
    $mui = 'Registry::HKEY_CURRENT_USER\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache'
    $muiHit = (Get-ItemProperty -Path $mui).PSObject.Properties |
        Where-Object { $_.Name -like '*wuthering*client-win64-shipping.exe*' } | Select-Object -First 1
    if ($muiHit) {
        $r = Resolve-GameRoot (($muiHit.Name -split '\\Client\\Binaries\\')[0])
        if ($r) { return $r }
    }

    # Firewall rules
    $fwPath = 'Registry::HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\FirewallRules'
    $fw = (Get-ItemProperty -Path $fwPath).PSObject.Properties |
        Where-Object { $_.Value -like '*wuthering*' -and $_.Value -like '*client-win64-shipping*' } | Select-Object -First 1
    if ($fw) {
        $r = Resolve-GameRoot ((($fw.Value -split 'App=')[1] -split '\\client\\binaries\\')[0])
        if ($r) { return $r }
    }

    # Uninstall registry
    $reg = Get-ItemProperty -Path @(
        "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    ) | Where-Object { $_.DisplayName -like '*wuthering*' } | Select-Object -First 1 -ExpandProperty InstallPath
    $r = Resolve-GameRoot $reg
    if ($r) { return $r }

    # Common install paths across all drives (incl. Steam / SteamLibrary / Epic)
    foreach ($d in (Get-PSDrive -PSProvider FileSystem).Name) {
        foreach ($b in @(
            "$d`:\Wuthering Waves Game", "$d`:\Wuthering Waves",
            "$d`:\Program Files\Wuthering Waves",
            "$d`:\Program Files (x86)\Steam\steamapps\common\Wuthering Waves",
            "$d`:\Steam\steamapps\common\Wuthering Waves",
            "$d`:\SteamLibrary\steamapps\common\Wuthering Waves",
            "$d`:\Games\Steam\steamapps\common\Wuthering Waves",
            "$d`:\Program Files\Epic Games\WutheringWavesj3oFh"
        )) {
            $r = Resolve-GameRoot $b
            if ($r) { return $r }
        }
    }
    return $null
}

# Read file bytes even while the game holds the file open.
function Read-SharedBytes {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $stream = $null; $ms = $null
    try {
        $share = [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete
        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, $share)
        $ms = [System.IO.MemoryStream]::new()
        $stream.CopyTo($ms)
        return $ms.ToArray()
    } catch { return $null }
    finally {
        if ($ms) { $ms.Dispose() }
        if ($stream) { $stream.Dispose() }
    }
}

# De-obfuscate Client.log bytes (Kuro XOR scheme) and decode as UTF-8.
function Get-ClientLogText {
    param([byte[]]$Bytes)
    if (-not $Bytes) { return $null }
    for ($i = 0; $i -lt $Bytes.Length; $i++) {
        $b = [int]$Bytes[$i]
        if ((($b -band 0x0F) % 2) -eq 1) { $Bytes[$i] = [byte]($b -bxor 0xA5) }
        else                             { $Bytes[$i] = [byte]($b -bxor 0xEF) }
    }
    return [System.Text.Encoding]::UTF8.GetString($Bytes)
}

$gamePath = Find-GamePath
if (-not $gamePath) {
    $manual = Read-Host "Auto-detect failed. Paste your game install path (the folder containing 'Wuthering Waves Game')"
    $gamePath = Resolve-GameRoot $manual
    if (-not $gamePath) { Write-Host "Client.log not found at that path. Aborting." -ForegroundColor Red; return }
}
Write-Host "Game folder: $gamePath" -ForegroundColor DarkGray

$pattern = 'https://aki-gm-resources(-oversea)?\.aki-game\.(net|com)/aki/gacha/index\.html#/record[^"\s]*'

# Sources, newest first. Client*.log is XOR-obfuscated; debug.log is plaintext.
$logsDir = Join-Path $gamePath 'Client\Saved\Logs'
$webView = Join-Path $gamePath 'Client\Binaries\Win64\ThirdParty\KrPcSdk_Global\KRSDKRes\KRSDKWebView'

$logs = @()
$logs += Get-ChildItem -Path $logsDir -Filter 'Client*.log' -File -ErrorAction SilentlyContinue |
    ForEach-Object { [pscustomobject]@{ Path = $_.FullName; Time = $_.LastWriteTime; Enc = 'xor' } }
$logs += Get-ChildItem -Path $webView -Filter 'debug.log' -File -Recurse -ErrorAction SilentlyContinue |
    ForEach-Object { [pscustomobject]@{ Path = $_.FullName; Time = $_.LastWriteTime; Enc = 'plain' } }
$logs = @($logs | Sort-Object Time -Descending)

$url = $null; $foundIn = $null
foreach ($lf in $logs) {
    $bytes = Read-SharedBytes $lf.Path
    if (-not $bytes) { continue }
    $text = if ($lf.Enc -eq 'xor') { Get-ClientLogText $bytes } else { [System.Text.Encoding]::UTF8.GetString($bytes) }
    if (-not $text) { continue }
    $m = [regex]::Matches($text, $pattern)
    if ($m.Count -gt 0) { $url = $m[$m.Count - 1].Value; $foundIn = $lf.Path; break }
}

if ($url) {
    Set-Clipboard -Value $url
    Write-Host "Found in: $foundIn" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Convene URL copied to clipboard:" -ForegroundColor Green
    Write-Host $url -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Now paste it into the Convene tracker page in Wuwa Toolkit." -ForegroundColor Cyan
} else {
    Write-Host "No Convene URL found." -ForegroundColor Red
    Write-Host "Open Convene -> History in-game, wait for your pulls to load, then re-run (keep the game open)." -ForegroundColor Yellow
    Write-Host ("(scanned {0} log file(s))" -f $logs.Count) -ForegroundColor DarkGray
}

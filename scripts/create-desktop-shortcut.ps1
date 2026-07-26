# 在桌面创建「销售驾驶舱」启动快捷方式，并把 public/app-icon.ico 应用上去。
# 图标本身由 public/app-icon.svg 源文件 + 重新生成的 public/app-icon.ico 提供。
# 用法（PowerShell，可双击）：
#   powershell -ExecutionPolicy Bypass -File .\scripts\create-desktop-shortcut.ps1

param(
  [string]$ShortcutName = '销售驾驶舱'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$batPath     = Join-Path $projectRoot 'start-dashboard.bat'
$iconPath    = Join-Path $projectRoot 'public\app-icon.ico'

if (-not (Test-Path -LiteralPath $batPath))  { throw "找不到 $batPath" }
if (-not (Test-Path -LiteralPath $iconPath)) { throw "找不到 $iconPath（先确认 public/app-icon.ico 存在）" }

$desktop    = [Environment]::GetFolderPath('Desktop')
$shortcutLnk = Join-Path $desktop "$ShortcutName.lnk"

# 已有同名快捷方式先删掉，避免残留旧图标缓存。
if (Test-Path -LiteralPath $shortcutLnk) { Remove-Item -LiteralPath $shortcutLnk -Force }

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcutLnk)
$sc.TargetPath       = $batPath
$sc.WorkingDirectory = $projectRoot
$sc.IconLocation     = "$iconPath,0"
$sc.Description      = '一键启动销售驾驶舱（Vite + http://127.0.0.1:5173/）'
$sc.Save()

Write-Host ""
Write-Host "已生成桌面快捷方式：$shortcutLnk" -ForegroundColor Green
Write-Host "图标源：$iconPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "提示：桌面图标若仍是旧图标，按 F5 刷新即可看到新图标。"

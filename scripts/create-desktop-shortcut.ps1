param(
  [string]$ShortcutName = ''
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $projectRoot 'start-dashboard.bat'
$publicDir = Join-Path $projectRoot 'public'
$iconPath = Join-Path $publicDir 'app-icon.ico'

if (-not (Test-Path -LiteralPath $launcherPath)) {
  throw "Launcher not found: $launcherPath"
}

if ([string]::IsNullOrWhiteSpace($ShortcutName)) {
  $ShortcutName = [string]::Concat(
    [char]0x9500,
    [char]0x552E,
    [char]0x5DE5,
    [char]0x4F5C,
    [char]0x53F0
  )
}

if (-not (Test-Path -LiteralPath $publicDir)) {
  New-Item -ItemType Directory -Path $publicDir | Out-Null
}

Add-Type -AssemblyName System.Drawing

function New-IconPngBytes {
  param([int]$Size)

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 37, 99, 235),
    [System.Drawing.Color]::FromArgb(255, 15, 118, 110),
    45
  )
  $graphics.FillRectangle($brush, $rect)

  $fontFamily = New-Object System.Drawing.FontFamily 'Microsoft YaHei'
  $fontSize = [Math]::Max(12, [Math]::Round($Size * 0.36))
  $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $text = [string][char]0x552E
  $textSize = $graphics.MeasureString($text, $font)
  $textX = ($Size - $textSize.Width) / 2
  $textY = ($Size - $textSize.Height) / 2 - ($Size * 0.03)
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $graphics.DrawString($text, $font, $textBrush, $textX, $textY)

  $accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 153, 246, 228))
  $graphics.FillEllipse($accentBrush, $Size * 0.66, $Size * 0.68, $Size * 0.16, $Size * 0.16)

  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  [byte[]]$bytes = $stream.ToArray()

  $graphics.Dispose()
  $bitmap.Dispose()
  $brush.Dispose()
  $font.Dispose()
  $fontFamily.Dispose()
  $textBrush.Dispose()
  $accentBrush.Dispose()
  $stream.Dispose()

  return ,$bytes
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = foreach ($size in $sizes) {
  [pscustomobject]@{
    Size = $size
    Bytes = New-IconPngBytes -Size $size
  }
}

$fileStream = [System.IO.File]::Create($iconPath)
$writer = New-Object System.IO.BinaryWriter($fileStream)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$images.Count)

$offset = 6 + ($images.Count * 16)
foreach ($image in $images) {
  $entrySize = if ($image.Size -eq 256) { 0 } else { $image.Size }
  $writer.Write([byte]$entrySize)
  $writer.Write([byte]$entrySize)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$image.Bytes.Length)
  $writer.Write([UInt32]$offset)
  $offset += $image.Bytes.Length
}

foreach ($image in $images) {
  $writer.Write($image.Bytes)
}

$writer.Dispose()
$fileStream.Dispose()

$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "$ShortcutName.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcherPath
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = $iconPath
$shortcut.Description = 'Start local sales dashboard'
$shortcut.Save()

Write-Host "Shortcut created: $shortcutPath"
Write-Host "Icon file: $iconPath"

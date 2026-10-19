Add-Type -AssemblyName System.Drawing

function Create-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2.0
    if ($d -gt $w) { $d = $w }
    if ($d -gt $h) { $d = $h }
    $path.AddArc($x, $y, $d, $d, 180.0, 90.0)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270.0, 90.0)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0.0, 90.0)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90.0, 90.0)
    $path.CloseFigure()
    return $path
}

function Draw-StocklyBars([System.Drawing.Graphics]$g, [float]$cx, [float]$cy, [float]$markW, [float]$markH) {
    # In canonical 64x64 coordinates:
    # Top bar: (6, 8, 40, 12, r=6) -> center (26, 14)
    # Mid bar: (18, 26, 40, 12, r=6) -> center (38, 32)
    # Bot bar: (6, 44, 40, 12, r=6) -> center (26, 50)
    # Total span: X from 6 to 58 (width 52), Y from 8 to 56 (height 48)
    # Center of bars is (32, 32).
    
    $scaleX = $markW / 52.0
    $scaleY = $markH / 48.0
    $s = [Math]::Min($scaleX, $scaleY)
    
    $barW = 40.0 * $s
    $barH = 12.0 * $s
    $barR = 6.0 * $s
    $offset = 12.0 * $s
    $gapY = 18.0 * $s
    
    $topY = $cy - ($gapY) - ($barH / 2.0)
    $midY = $cy - ($barH / 2.0)
    $botY = $cy + ($gapY) - ($barH / 2.0)
    
    $leftX = $cx - ($offset / 2.0) - ($barW / 2.0)
    $rightX = $leftX + $offset
    
    $brushCharcoal = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#151515"))
    $brushCharcoalAlpha = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(184, 21, 21, 21))
    $brushLime = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#C7FF4D"))
    $penStroke = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#151515"), [Math]::Max(1.5, 2.8 * $s))
    $penStroke.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    
    # 1. Top Bar
    $p1 = Create-RoundedRectPath $leftX $topY $barW $barH $barR
    $g.FillPath($brushCharcoal, $p1)
    $p1.Dispose()
    
    # 2. Mid Bar
    $p2 = Create-RoundedRectPath $rightX $midY $barW $barH $barR
    $g.FillPath($brushCharcoalAlpha, $p2)
    $p2.Dispose()
    
    # 3. Bottom Bar
    $p3 = Create-RoundedRectPath $leftX $botY $barW $barH $barR
    $g.FillPath($brushLime, $p3)
    $g.DrawPath($penStroke, $p3)
    $p3.Dispose()
    
    $brushCharcoal.Dispose()
    $brushCharcoalAlpha.Dispose()
    $brushLime.Dispose()
    $penStroke.Dispose()
}

function Generate-Icons($resDir) {
    $configs = @(
        @{ Dir = "mipmap-mdpi";    Launcher = 48;  Fg = 108 },
        @{ Dir = "mipmap-hdpi";    Launcher = 72;  Fg = 162 },
        @{ Dir = "mipmap-xhdpi";   Launcher = 96;  Fg = 216 },
        @{ Dir = "mipmap-xxhdpi";  Launcher = 144; Fg = 324 },
        @{ Dir = "mipmap-xxxhdpi"; Launcher = 192; Fg = 432 }
    )
    
    foreach ($cfg in $configs) {
        $targetDir = Join-Path $resDir $cfg.Dir
        if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
        
        $S = [float]$cfg.Launcher
        $F = [float]$cfg.Fg
        
        # --- A. ic_launcher.png (Rounded squircle icon) ---
        $bmpL = New-Object System.Drawing.Bitmap([int]$S, [int]$S)
        $gL = [System.Drawing.Graphics]::FromImage($bmpL)
        $gL.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $gL.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $gL.Clear([System.Drawing.Color]::Transparent)
        
        # White squircle
        $bgPath = Create-RoundedRectPath 1.0 1.0 ($S - 2.0) ($S - 2.0) ($S * 0.22)
        $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $gL.FillPath($bgBrush, $bgPath)
        $bgBrush.Dispose()
        $bgPath.Dispose()
        
        # Draw bars (occupy ~74% of icon)
        Draw-StocklyBars $gL ($S / 2.0) ($S / 2.0) ($S * 0.72) ($S * 0.66)
        $gL.Dispose()
        $launcherPath = Join-Path $targetDir "ic_launcher.png"
        $bmpL.Save($launcherPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmpL.Dispose()
        
        # --- B. ic_launcher_round.png (Circular icon) ---
        $bmpR = New-Object System.Drawing.Bitmap([int]$S, [int]$S)
        $gR = [System.Drawing.Graphics]::FromImage($bmpR)
        $gR.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $gR.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $gR.Clear([System.Drawing.Color]::Transparent)
        
        # White circle
        $circleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $gR.FillEllipse($circleBrush, 1.0, 1.0, ($S - 2.0), ($S - 2.0))
        $circleBrush.Dispose()
        
        # Draw bars (occupy ~64% of circular icon to stay well within circular mask)
        Draw-StocklyBars $gR ($S / 2.0) ($S / 2.0) ($S * 0.62) ($S * 0.58)
        $gR.Dispose()
        $roundPath = Join-Path $targetDir "ic_launcher_round.png"
        $bmpR.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmpR.Dispose()
        
        # --- C. ic_launcher_foreground.png (Adaptive icon layer) ---
        $bmpF = New-Object System.Drawing.Bitmap([int]$F, [int]$F)
        $gF = [System.Drawing.Graphics]::FromImage($bmpF)
        $gF.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $gF.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $gF.Clear([System.Drawing.Color]::Transparent)
        
        # Draw bars in safe area (safe area is 72/108 = 66.6% diameter)
        # Mark size in 108dp base is 48w x 44h -> 44.4% of canvas
        $fgMarkW = $F * (48.0 / 108.0)
        $fgMarkH = $F * (44.0 / 108.0)
        Draw-StocklyBars $gF ($F / 2.0) ($F / 2.0) $fgMarkW $fgMarkH
        $gF.Dispose()
        $fgPath = Join-Path $targetDir "ic_launcher_foreground.png"
        $bmpF.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmpF.Dispose()
        
        Write-Host "Generated icons for $($cfg.Dir)"
    }
}

$resPath = "C:\Users\dravy_qci9mn7\OneDrive\Desktop\Stockly\apps\mobile\android\app\src\main\res"
Generate-Icons $resPath
Write-Host "All Android icons generated successfully!"

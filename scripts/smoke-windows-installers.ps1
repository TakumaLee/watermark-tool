$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Wait-ProcessSuccess {
    param([System.Diagnostics.Process]$Process, [int]$TimeoutMilliseconds = 180000)
    if (-not $Process.WaitForExit($TimeoutMilliseconds)) {
        $Process.Kill($true)
        throw "Process $($Process.Id) timed out"
    }
    if ($Process.ExitCode -ne 0) {
        throw "Process $($Process.Id) exited with $($Process.ExitCode)"
    }
}

$installers = @(Get-ChildItem 'src-tauri/target/release/bundle/nsis/*.exe')
$msiFiles = @(Get-ChildItem 'src-tauri/target/release/bundle/msi/*.msi')
if ($installers.Count -ne 1 -or $msiFiles.Count -ne 1) {
    throw 'Expected exactly one NSIS installer and one MSI package'
}

$installDir = Join-Path $env:RUNNER_TEMP 'watermark-install-smoke'
$installProcess = Start-Process -FilePath $installers[0].FullName -ArgumentList '/S', "/D=$installDir" -PassThru
Wait-ProcessSuccess $installProcess

$appFiles = @(Get-ChildItem $installDir -Filter '*.exe' | Where-Object { $_.Name -notmatch '^(ffmpeg|ffprobe|uninstall)' })
if ($appFiles.Count -ne 1) { throw 'Could not identify the installed application executable' }
$ffmpeg = Join-Path $installDir 'ffmpeg.exe'
$ffprobe = Join-Path $installDir 'ffprobe.exe'
foreach ($tool in @($ffmpeg, $ffprobe)) {
    if (-not (Test-Path $tool)) { throw "Missing bundled tool: $tool" }
    & $tool -version
    if ($LASTEXITCODE -ne 0) { throw "Bundled tool failed: $tool" }
}
$licenses = @(Get-ChildItem $installDir -Recurse -File | Where-Object { $_.Name -eq 'LICENSE' })
if (-not ($licenses | Where-Object { (Get-Content $_.FullName -Raw) -match 'GNU GENERAL PUBLIC LICENSE' })) {
    throw 'FFmpeg GPL license missing from installed resources'
}

# Exercise the installed binaries, including H.264 and image overlay.
$fixtureDir = Join-Path $env:RUNNER_TEMP 'watermark-media-smoke'
New-Item -ItemType Directory -Force -Path $fixtureDir | Out-Null
$source = Join-Path $fixtureDir 'source.mp4'
$mark = Join-Path $fixtureDir 'mark.png'
$output = Join-Path $fixtureDir 'watermarked.mp4'
& $ffmpeg -v error -y -f lavfi -i 'testsrc2=duration=1:size=320x180:rate=24' -c:v libx264 -pix_fmt yuv420p $source
if ($LASTEXITCODE -ne 0) { throw 'H.264 fixture encode failed' }
& $ffmpeg -v error -y -f lavfi -i 'color=c=white:s=32x16' -frames:v 1 $mark
if ($LASTEXITCODE -ne 0) { throw 'PNG fixture creation failed' }
& $ffmpeg -v error -y -i $source -i $mark -filter_complex '[0:v][1:v]overlay=20:20[vout]' -map '[vout]' -c:v libx264 -pix_fmt yuv420p $output
if ($LASTEXITCODE -ne 0) { throw 'Watermark overlay encode failed' }
$probeJson = & $ffprobe -v error -show_streams -show_format -of json $output
if ($LASTEXITCODE -ne 0) { throw 'Output metadata probe failed' }
$probe = ($probeJson -join "`n") | ConvertFrom-Json
$stream = @($probe.streams | Where-Object { $_.codec_type -eq 'video' })[0]
if ($stream.codec_name -ne 'h264' -or $stream.width -ne 320 -or $stream.height -ne 180 -or [double]$probe.format.duration -lt 0.9) {
    throw 'Unexpected output metadata'
}

# Require a native app window and detect the previous silent-startup-crash class.
$app = Start-Process -FilePath $appFiles[0].FullName -PassThru
try {
    $windowReady = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        $app.Refresh()
        if ($app.HasExited) { throw "Application exited during startup: $($app.ExitCode)" }
        if ($app.MainWindowHandle -ne [IntPtr]::Zero) { $windowReady = $true; break }
    }
    if (-not $windowReady) { throw 'Application did not create a native window' }
    Start-Sleep -Seconds 3
    $app.Refresh()
    if ($app.HasExited) { throw 'Application crashed after window creation' }
    $windowTitle = $app.MainWindowTitle
} finally {
    if (-not $app.HasExited) { $app.Kill($true) }
}

# Extract MSI contents without installing the app a second time.
$msiDir = Join-Path $env:RUNNER_TEMP 'watermark-msi-smoke'
$msiProcess = Start-Process msiexec.exe -ArgumentList '/a', "`"$($msiFiles[0].FullName)`"", '/qn', "TARGETDIR=`"$msiDir`"" -PassThru
Wait-ProcessSuccess $msiProcess
foreach ($name in @('ffmpeg.exe', 'ffprobe.exe', $appFiles[0].Name)) {
    $extracted = @(Get-ChildItem $msiDir -Recurse -Filter $name -File)
    if ($extracted.Count -ne 1) { throw "MSI is missing a unique $name" }
    if ($name -eq $appFiles[0].Name) {
        # Tauri patches the PE .taubndl target to NSS/MSI for each installer.
        # Validate that exact marker and require every other byte to match.
        python scripts/verify-windows-payloads.py (Join-Path $installDir $name) $extracted[0].FullName
        if ($LASTEXITCODE -ne 0) { throw 'MSI/NSIS application payload mismatch' }
    } elseif ((Get-FileHash $extracted[0].FullName).Hash -ne (Get-FileHash (Join-Path $installDir $name)).Hash) {
        throw "MSI/NSIS payload mismatch for $name"
    }
}

@{
    commit = $env:GITHUB_SHA
    version = (Get-Content package.json -Raw | ConvertFrom-Json).version
    platform = 'windows-x64'
    nsisSilentInstall = 'passed'
    appWindow = $windowTitle
    installedFFmpegOverlay = 'passed'
    msiPayloadExtraction = 'passed'
    appPayloadComparison = 'passed: identical except the Tauri NSS/MSI bundle marker'
    signing = 'unsigned'
    note = 'CI startup/media smoke checks; not a complete interactive editing test or a Windows 10 hardware compatibility test.'
} | ConvertTo-Json | Set-Content "$env:RUNNER_TEMP/watermark-smoke-report.json" -Encoding utf8NoBOM

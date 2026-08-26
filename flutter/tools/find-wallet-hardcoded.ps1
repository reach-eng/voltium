# Find hardcoded English string literals in the wallet presentation
# files. Skips JSON keys, error-throw bodies, enum cases, and
# import paths. Emits file:line:content.
$ErrorActionPreference = 'Stop'
$root = 'lib/features/wallet/presentation'
$excludeRegex = '^(import|.*AppConstants\.|.*case [A-Z]|.*throw )'

Get-ChildItem -Path $root -Recurse -Filter '*.dart' | ForEach-Object {
    $f = $_.FullName
    Select-String -Path $f -Pattern "'[A-Z][a-zA-Z &\-]{3,}'" |
    Where-Object { -not ($_.Line -match $excludeRegex) } |
    ForEach-Object {
        $rel = $f.Substring($f.IndexOf('presentation'))
        "$rel`:$($_.LineNumber)`: $($_.Line.Trim())"
    }
} | Sort-Object -Unique | Select-Object -First 60

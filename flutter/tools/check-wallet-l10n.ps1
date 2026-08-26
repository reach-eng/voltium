# Audit wallet/history/topup screens for hardcoded English strings.
# Skips lines that already use l10n fallbacks — the '??' on the prior
# line and the string on this one are part of the same call.
$ErrorActionPreference = 'Stop'
$root = 'lib/features/wallet/presentation'
$excludeRegex = '^(import|.*AppConstants\.|.*case [A-Z]|.*throw |package:|\s*//|debugPrint)'

# Walk all .dart files, accumulate (lineNumber, line) pairs, and skip
# a line that is the right-hand side of `??` (i.e., the previous line
# ended with `??`).
$reports = @()
Get-ChildItem -Path $root -Recurse -Filter '*.dart' | ForEach-Object {
    $f = $_.FullName
    $lines = Get-Content -LiteralPath $f -Encoding UTF8
    $prev = ''
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $trimmed = $line.TrimStart()
        $isRhsOfNullCoalesce = $prev -match '\?\?\s*$'
        if (
            $trimmed -match "'[A-Z][a-zA-Z &\-]{3,}'" -and
            -not ($trimmed -match $excludeRegex) -and
            -not $isRhsOfNullCoalesce
        ) {
            $rel = $f.Substring($f.IndexOf('presentation'))
            $reports += "$rel`:$($i + 1)`: $($line.Trim())"
        }
        $prev = $line
    }
}
$reports | Select-Object -First 50

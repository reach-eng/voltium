# Audit the Flutter app localization completeness.
$ErrorActionPreference = 'Stop'
$en = Get-Content 'lib/l10n/app_en.arb' -Raw -Encoding UTF8
$hi = Get-Content 'lib/l10n/app_hi.arb' -Raw -Encoding UTF8

$devaStart = 2304   # U+0900
$devaEnd = 2431     # U+097F

$pattern = '(?ms)^\s+"([^@][^"]+?)"\s*:\s*"([^"]*)"\s*[,}]'
$keys = [regex]::Matches($en, $pattern)
Write-Output "Total EN key/value rows: $($keys.Count)"

$translated = 0
$untranslated = 0
$skip = 0
$placeholderLike = 0
$suspect = @()

foreach ($k in $keys) {
    $key = $k.Groups[1].Value
    $enVal = $k.Groups[2].Value
    $hiPattern = '"' + [regex]::Escape($key) + '"\s*:\s*"([^"]*)"'
    $hiMatch = [regex]::Match($hi, $hiPattern)
    if (-not $hiMatch.Success) {
        $skip++
        continue
    }
    $hiVal = $hiMatch.Groups[1].Value
    if ($enVal -eq $hiVal -and $enVal.Length -gt 0) {
        $translated++
        $looksEnglish = $true
        foreach ($ch in $enVal.ToCharArray()) {
            $code = [int][char]$ch
            if ($code -lt 65 -or $code -gt 122) {
                if ($code -lt 48 -or $code -gt 57) {
                    $looksEnglish = $false
                    break
                }
            }
        }
        $hasDevanagari = $false
        foreach ($ch in $enVal.ToCharArray()) {
            $code = [int][char]$ch
            if ($code -ge $devaStart -and $code -le $devaEnd) {
                $hasDevanagari = $true
                break
            }
        }
        if ($looksEnglish -and -not $hasDevanagari) {
            $placeholderLike++
            $suspect += [PSCustomObject]@{ Key = $key; EN = $enVal }
        }
    } elseif ($enVal -ne $hiVal -and $enVal.Length -gt 0) {
        $untranslated++
    }
}

Write-Output "Translated (HI != EN, Devanagari): $($translated - $placeholderLike)"
Write-Output "Looks like English copy in HI (suspect): $placeholderLike"
Write-Output "Untranslated (HI != EN, different): $untranslated"
Write-Output "Missing in HI: $skip"
Write-Output ""
Write-Output "Top 30 suspect (EN copy in HI) keys:"
$suspect | Select-Object -First 30 | Format-Table -AutoSize -Wrap

$files = Get-ChildItem -Path test -Filter *.dart -Recurse

$replacements = @{
    "package:voltium_rider/core/state/wallet_provider.dart" = "package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart"
    "package:voltium_rider/core/state/connectivity_provider.dart" = "package:voltium_rider/providers/connectivity_provider.dart"
    "package:voltium_rider/core/state/device_policy_provider.dart" = "package:voltium_rider/providers/device_policy_provider.dart"
    "package:voltium_rider/core/state/engagement_provider.dart" = "package:voltium_rider/providers/engagement_provider.dart"
    "package:voltium_rider/core/state/notification_provider.dart" = "package:voltium_rider/providers/notification_provider.dart"
    "package:voltium_rider/core/state/support_provider.dart" = "package:voltium_rider/providers/support_provider.dart"
}

foreach ($f in $files) {
    $c = Get-Content $f.FullName -Raw
    $changed = $false
    
    foreach ($key in $replacements.Keys) {
        if ($c -match $key) {
            $c = $c.Replace($key, $replacements[$key])
            $changed = $true
        }
    }
    
    if ($changed) {
        Set-Content $f.FullName $c -NoNewline
    }
}

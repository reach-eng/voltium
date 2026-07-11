$files = Get-ChildItem -Path test -Filter *.dart -Recurse

foreach ($f in $files) {
    $c = Get-Content $f.FullName -Raw
    $changed = $false
    
    if ($c -match "MultiProvider|ChangeNotifierProvider|import 'package:provider/provider.dart';") {
        
        $c = $c -replace "import 'package:provider/provider\.dart';", "import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';"
        
        $c = $c -replace 'MultiProvider\s*\(\s*providers:\s*\[([\s\S]*?)\],\s*child:\s*([\s\S]*?)(,)?\s*\)', 'ProviderScope(overrides: [$1], child: $2$3)'
        
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]+)\((.*?)\),\s*child:\s*([\s\S]*?)(,)?\s*\)', 'ProviderScope(overrides: [ $1_MARKER_overrideWith((ref) => $1($2)) ], child: $3$4)'
        
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*AppProvider[^()]*)\((.*?)\)\s*,?\)', 'appProvider.overrideWith((ref) => $1($2)),'
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*RiderProvider[^()]*)\((.*?)\)\s*,?\)', 'riderProvider.overrideWith((ref) => $1($2)),'
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*WalletProvider[^()]*)\((.*?)\)\s*,?\)', 'walletProvider.overrideWith((ref) => $1($2)),'
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*SupportProvider[^()]*)\((.*?)\)\s*,?\)', 'supportProvider.overrideWith((ref) => $1($2)),'
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*EngagementProvider[^()]*)\((.*?)\)\s*,?\)', 'engagementProvider.overrideWith((ref) => $1($2)),'
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*DevicePolicyProvider[^()]*)\((.*?)\)\s*,?\)', 'devicePolicyProvider.overrideWith((ref) => $1($2)),'
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*ConnectivityProvider[^()]*)\((.*?)\)\s*,?\)', 'connectivityProvider.overrideWith((ref) => $1($2)),'
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*NotificationProvider[^()]*)\((.*?)\)\s*,?\)', 'notificationProvider.overrideWith((ref) => $1($2)),'
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*LocaleProvider[^()]*)\((.*?)\)\s*,?\)', 'localeProviderRef.overrideWith((ref) => $1($2)),'
        $c = $c -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*ThemeProvider[^()]*)\((.*?)\)\s*,?\)', 'themeProviderRef.overrideWith((ref) => $1($2)),'
        
        $c = $c -replace '([^()]*AppProvider[^()]*)_MARKER_overrideWith', 'appProvider.overrideWith'
        $c = $c -replace '([^()]*RiderProvider[^()]*)_MARKER_overrideWith', 'riderProvider.overrideWith'
        $c = $c -replace '([^()]*WalletProvider[^()]*)_MARKER_overrideWith', 'walletProvider.overrideWith'
        $c = $c -replace '([^()]*SupportProvider[^()]*)_MARKER_overrideWith', 'supportProvider.overrideWith'
        $c = $c -replace '([^()]*EngagementProvider[^()]*)_MARKER_overrideWith', 'engagementProvider.overrideWith'
        $c = $c -replace '([^()]*DevicePolicyProvider[^()]*)_MARKER_overrideWith', 'devicePolicyProvider.overrideWith'
        $c = $c -replace '([^()]*ConnectivityProvider[^()]*)_MARKER_overrideWith', 'connectivityProvider.overrideWith'
        $c = $c -replace '([^()]*NotificationProvider[^()]*)_MARKER_overrideWith', 'notificationProvider.overrideWith'
        $c = $c -replace '([^()]*LocaleProvider[^()]*)_MARKER_overrideWith', 'localeProviderRef.overrideWith'
        $c = $c -replace '([^()]*ThemeProvider[^()]*)_MARKER_overrideWith', 'themeProviderRef.overrideWith'
        
        $changed = $true
    }
    
    if ($changed) {
        Set-Content $f.FullName $c -NoNewline
    }
}

 = Get-ChildItem -Path test -Filter *.dart -Recurse

foreach ( in ) {
     = Get-Content .FullName -Raw
     = False
    
    if ( -match "MultiProvider|ChangeNotifierProvider") {
        
         =  -replace "import 'package:provider/provider\.dart';", "import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';"
        
         =  -replace 'MultiProvider\s*\(\s*providers:\s*\[([\s\S]*?)\],\s*child:\s*([\s\S]*?)(,)?\s*\)', 'ProviderScope(overrides: [], child: )'
        
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]+)\((.*?)\),\s*child:\s*([\s\S]*?)(,)?\s*\)', 'ProviderScope(overrides: [ ((ref) => ()) ], child: )'
        
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*AppProvider[^()]*)\((.*?)\)\s*,?\)', 'appProvider.overrideWith((ref) => $1($2)),'
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*RiderProvider[^()]*)\((.*?)\)\s*,?\)', 'riderProvider.overrideWith((ref) => $1($2)),'
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*WalletProvider[^()]*)\((.*?)\)\s*,?\)', 'walletProvider.overrideWith((ref) => $1($2)),'
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*SupportProvider[^()]*)\((.*?)\)\s*,?\)', 'supportProvider.overrideWith((ref) => $1($2)),'
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*EngagementProvider[^()]*)\((.*?)\)\s*,?\)', 'engagementProvider.overrideWith((ref) => $1($2)),'
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*DevicePolicyProvider[^()]*)\((.*?)\)\s*,?\)', 'devicePolicyProvider.overrideWith((ref) => $1($2)),'
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*ConnectivityProvider[^()]*)\((.*?)\)\s*,?\)', 'connectivityProvider.overrideWith((ref) => $1($2)),'
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*NotificationProvider[^()]*)\((.*?)\)\s*,?\)', 'notificationProvider.overrideWith((ref) => $1($2)),'
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*LocaleProvider[^()]*)\((.*?)\)\s*,?\)', 'localeProviderRef.overrideWith((ref) => $1($2)),'
         =  -replace 'ChangeNotifierProvider(?:<[^>]+>)?\(\s*create:\s*\([^)]+\)\s*=>\s*([^()]*ThemeProvider[^()]*)\((.*?)\)\s*,?\)', 'themeProviderRef.overrideWith((ref) => $1($2)),'
        
         =  -replace '([^()]*AppProvider[^()]*)_MARKER_overrideWith', 'appProvider.overrideWith'
         =  -replace '([^()]*RiderProvider[^()]*)_MARKER_overrideWith', 'riderProvider.overrideWith'
         =  -replace '([^()]*WalletProvider[^()]*)_MARKER_overrideWith', 'walletProvider.overrideWith'
         =  -replace '([^()]*SupportProvider[^()]*)_MARKER_overrideWith', 'supportProvider.overrideWith'
         =  -replace '([^()]*EngagementProvider[^()]*)_MARKER_overrideWith', 'engagementProvider.overrideWith'
         =  -replace '([^()]*DevicePolicyProvider[^()]*)_MARKER_overrideWith', 'devicePolicyProvider.overrideWith'
         =  -replace '([^()]*ConnectivityProvider[^()]*)_MARKER_overrideWith', 'connectivityProvider.overrideWith'
         =  -replace '([^()]*NotificationProvider[^()]*)_MARKER_overrideWith', 'notificationProvider.overrideWith'
         =  -replace '([^()]*LocaleProvider[^()]*)_MARKER_overrideWith', 'localeProviderRef.overrideWith'
         =  -replace '([^()]*ThemeProvider[^()]*)_MARKER_overrideWith', 'themeProviderRef.overrideWith'
        
         = True
    }
    
    if () {
        Set-Content .FullName  -NoNewline
    }
}

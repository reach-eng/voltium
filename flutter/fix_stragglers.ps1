# 1. Fix pre_dashboard_screen_test.dart
$f = "test/dashboard/pre_dashboard_screen_test.dart"
$c = Get-Content $f -Raw
$c = $c -replace 'ChangeNotifierProvider<AppProvider>\(\s*create:\s*\([^)]+\)\s*=>\s*AppProvider\(\),\s*\)', 'appProvider.overrideWith((ref) => AppProvider())'
$c = $c -replace 'ChangeNotifierProvider<RiderProvider>\(\s*create:\s*\([^)]+\)\s*=>\s*RiderProvider\(\s*riderRepository:\s*mockRiderRepo,\s*rentalRepository:\s*mockRentalRepo,\s*filesRepository:\s*mockFilesRepo,\s*\)\.\.setRider\(rider\),\s*\)', 'riderProvider.overrideWith((ref) => RiderProvider(riderRepository: mockRiderRepo, rentalRepository: mockRentalRepo, filesRepository: mockFilesRepo)..setRider(rider))'
Set-Content $f $c -NoNewline

# 2. Fix emergency_contacts_screen_test.dart
$f = "test/emergency/emergency_contacts_screen_test.dart"
$c = Get-Content $f -Raw
$c = $c -replace 'EmergencyContactsService_MARKER_overrideWith', 'emergencyContactsService.overrideWith'
Set-Content $f $c -NoNewline

# 3. Fix guarantor_onboarding_screen_test.dart
$f = "test/features/guarantor/presentation/screens/guarantor_onboarding_screen_test.dart"
$c = Get-Content $f -Raw
$c = $c -replace 'final appProvider = AppProvider\(\);', 'final testAppProvider = AppProvider();'
$c = $c -replace 'appProvider\.overrideWith\(\(ref\) => appProvider\)', 'appProvider.overrideWith((ref) => testAppProvider)'
Set-Content $f $c -NoNewline

# 4. Fix dashboard_scooter_banner_test.dart
$f = "test/features/dashboard/widgets/dashboard_scooter_banner_test.dart"
$c = Get-Content $f -Raw
$c = $c -replace 'package:voltium_rider/features/dashboard/widgets/dashboard_scooter_banner.dart', 'package:voltium_rider/widgets/dashboard_scooter_banner.dart'
Set-Content $f $c -NoNewline


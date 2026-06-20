#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

required_admin=(
  web/src/components/admin/screens/DashboardOverview.tsx
  web/src/components/admin/screens/RiderManagement.tsx
  web/src/components/admin/screens/KycManagement.tsx
  web/src/components/admin/screens/GuarantorManagement.tsx
  web/src/components/admin/screens/RentalManagement.tsx
  web/src/components/admin/screens/VehicleManagement.tsx
  web/src/components/admin/screens/HubManagement.tsx
  web/src/components/admin/screens/PlanManagement.tsx
  web/src/components/admin/screens/WalletDepositManagement.tsx
  web/src/components/admin/screens/TransactionManagement.tsx
  web/src/components/admin/screens/PickupReturnBoard.tsx
  web/src/components/admin/screens/TicketManagement.tsx
  web/src/components/admin/screens/IncidentManagementScreen.tsx
  web/src/components/admin/screens/TeamLeaderManagement.tsx
  web/src/components/admin/screens/OperationsBoard.tsx
  web/src/components/admin/screens/FleetMapScreen.tsx
  web/src/components/admin/screens/ShiftManagement.tsx
  web/src/components/admin/screens/RiderScoringScreen.tsx
  web/src/components/admin/screens/NotificationManagement.tsx
  web/src/components/admin/screens/BulkMessagingScreen.tsx
  web/src/components/admin/screens/OfferManagement.tsx
  web/src/components/admin/screens/RewardManagement.tsx
  web/src/components/admin/screens/ReferralManagement.tsx
  web/src/components/admin/screens/AnalyticsDashboard.tsx
  web/src/components/admin/screens/AdminUserManagement.tsx
  web/src/components/admin/screens/RolePermissionManagement.tsx
  web/src/components/admin/screens/AuditLogScreen.tsx
  web/src/components/admin/screens/FaqManagement.tsx
  web/src/components/admin/screens/LegalManagement.tsx
  web/src/components/admin/screens/FeatureFlagsScreen.tsx
  web/src/components/admin/screens/DeviceTrackingView.tsx
  web/src/components/admin/screens/SystemSettingsScreen.tsx
  web/src/components/admin/screens/ServerHealthScreen.tsx
  web/src/components/admin/screens/DataManagementScreen.tsx
  web/src/components/admin/screens/MaintenanceModeScreen.tsx
  web/src/components/admin/screens/WorkflowCoverageScreen.tsx
)

required_rider=(
  flutter/lib/features/onboarding/presentation/screens/splash_screen.dart
  flutter/lib/features/onboarding/presentation/screens/legal_screen.dart
  flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart
  flutter/lib/features/auth/presentation/screens/login_screen.dart
  flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart
  flutter/lib/features/kyc/presentation/screens/intent_of_use_screen.dart
  flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart
  flutter/lib/features/kyc/presentation/screens/signature_pad_screen.dart
  flutter/lib/features/kyc/presentation/screens/documents_screen.dart
  flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart
  flutter/lib/features/rentals/presentation/screens/choose_plan_screen.dart
  flutter/lib/features/wallet/presentation/screens/top_up_purpose_screen.dart
  flutter/lib/features/wallet/presentation/screens/top_up_amount_screen.dart
  flutter/lib/features/wallet/presentation/screens/top_up_upi_screen.dart
  flutter/lib/features/wallet/presentation/screens/top_up_proof_screen.dart
  flutter/lib/features/wallet/presentation/screens/top_up_receipt_screen.dart
  flutter/lib/features/pickup/presentation/screens/pickup_hub_screen.dart
  flutter/lib/features/pickup/presentation/screens/pickup_verification_screen.dart
  flutter/lib/features/pickup/presentation/screens/pickup_success_screen.dart
  flutter/lib/features/dashboard/presentation/screens/active_dashboard_screen.dart
  flutter/lib/features/rentals/presentation/screens/rental_details_screen.dart
  flutter/lib/features/rentals/presentation/screens/end_rental_screen.dart
  flutter/lib/features/wallet/presentation/screens/wallet_screen.dart
  flutter/lib/features/wallet/presentation/screens/history_screen.dart
  flutter/lib/features/support/presentation/screens/support_center_screen.dart
  flutter/lib/features/support/presentation/screens/support_checklist_screen.dart
  flutter/lib/features/support/presentation/screens/faq_screen.dart
  flutter/lib/features/support/presentation/screens/troubleshooter_screen.dart
  flutter/lib/features/support/presentation/screens/feedback_screen.dart
  flutter/lib/features/notifications/presentation/screens/notification_center_screen.dart
  flutter/lib/features/notifications/presentation/screens/notification_preferences_screen.dart
  flutter/lib/features/notifications/presentation/screens/smart_notifications_screen.dart
  flutter/lib/features/profile/presentation/screens/profile_screen.dart
  flutter/lib/features/profile/presentation/screens/edit_profile_screen.dart
  flutter/lib/features/profile/presentation/screens/app_settings_screen.dart
  flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart
  flutter/lib/features/referrals/presentation/screens/referral_screen.dart
  flutter/lib/features/rewards/presentation/screens/rewards_screen.dart
  flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart
  flutter/lib/features/device_compliance/presentation/screens/emergency_contacts_screen.dart
  flutter/lib/features/workflows/presentation/screens/rider_workflow_hub_screen.dart
)

for file in "${required_admin[@]}"; do
  [[ -f "$file" ]] || { echo "FAIL: missing admin screen $file"; exit 1; }
  echo "PASS: $file"
done
for file in "${required_rider[@]}"; do
  [[ -f "$file" ]] || { echo "FAIL: missing rider screen $file"; exit 1; }
  echo "PASS: $file"
done

grep -q "workflow-coverage" web/src/lib/role-config.ts || { echo "FAIL: workflow coverage nav missing"; exit 1; }
grep -q "RiderWorkflowHubScreen" flutter/lib/features/profile/presentation/screens/profile_screen.dart || { echo "FAIL: rider workflow hub not linked from profile"; exit 1; }
grep -q "AuthState.topUpProof" flutter/lib/app/router_body.dart || { echo "FAIL: top-up proof screen not routed"; exit 1; }

echo "PASS: admin and rider screen workflow coverage complete"

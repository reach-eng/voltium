# Voltium EV Platform Workflow Map

> Mapped automatically from the Graphify Knowledge Graph, highlighting core business flows, test specs, and file relationships.

## 📌 Rider Authentication & Onboarding

| Flow / Spec | File Path | Key Graph Connections |
| :--- | :--- | :--- |
| **onboarding-extended.spec.ts** | `e2e/onboarding-extended.spec.ts` | continueBtn, helpers.ts, loginAsRiderWithSession() |
| **continueBtn** | `e2e/onboarding-extended.spec.ts` | onboarding-extended.spec.ts |
| **onboarding-flow.spec.ts** | `e2e/onboarding-flow.spec.ts` | bankDetailsBtn, body, dummyFile, fileInputs (+4 more) |
| **styles** | `e2e/onboarding-flow.spec.ts` | onboarding-flow.spec.ts |
| **dummyFile** | `e2e/onboarding-flow.spec.ts` | onboarding-flow.spec.ts |
| **bankDetailsBtn** | `e2e/onboarding-flow.spec.ts` | onboarding-flow.spec.ts |
| **production-onboarding.spec.ts** | `e2e/production-onboarding.spec.ts` | guarantorData, helpers.ts, loginAsRiderWithSession(), store (+1 more) |
| **userData** | `e2e/production-onboarding.spec.ts` | production-onboarding.spec.ts |
| **guarantorData** | `e2e/production-onboarding.spec.ts` | production-onboarding.spec.ts |
| **buttons** | `e2e/vehicle-onboarding.spec.ts` | vehicle-onboarding.spec.ts |
| **captureBtns** | `e2e/vehicle-onboarding.spec.ts` | vehicle-onboarding.spec.ts |
| **vehiclePhotoBtn** | `e2e/vehicle-onboarding.spec.ts` | vehicle-onboarding.spec.ts |
| **canvas** | `e2e/vehicle-onboarding.spec.ts` | vehicle-onboarding.spec.ts |
| **vehicle-onboarding.spec.ts** | `e2e/vehicle-onboarding.spec.ts` | btn, buttons, canvas, captureBtns (+8 more) |
| **subscribBtn** | `e2e/vehicle-onboarding.spec.ts` | vehicle-onboarding.spec.ts |
| *And 21 more flows...* | | |


## 📌 KYC & Guarantor Verification

| Flow / Spec | File Path | Key Graph Connections |
| :--- | :--- | :--- |
| **kyc-approval.spec.ts** | `e2e/kyc-approval.spec.ts` | confirmBtn, helpers.ts, loginAsRiderWithSession(), switchToAdmin() |
| **confirmBtn** | `e2e/kyc-approval.spec.ts` | kyc-approval.spec.ts |
| **16_profile_kyc_status_test.dart** | `flutter/integration_test/e2e_individual/16_profile_kyc_status_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, navigateToTab (+3 more) |
| **34_guarantor_flow_test.dart** | `flutter/integration_test/e2e_individual/34_guarantor_flow_test.dart` | ../helpers/test_helpers.dart, completeAuthFlow, handlePreamble, launchApp (+5 more) |
| **35_kyc_notification_test.dart** | `flutter/integration_test/e2e_individual/35_kyc_notification_test.dart` | ../helpers/test_helpers.dart, expectOnDashboard, fullLoginFlow, main (+5 more) |
| **38_kyc_notification_flow_test.dart** | `flutter/integration_test/e2e_individual/38_kyc_notification_flow_test.dart` | ../helpers/test_helpers.dart, expectOnDashboard, fullLoginFlow, goBack (+6 more) |


## 📌 Wallet, Deposits & Payments

| Flow / Spec | File Path | Key Graph Connections |
| :--- | :--- | :--- |
| **rent-payment.spec.ts** | `e2e/rent-payment.spec.ts` | approveBtn, helpers.ts, loginAsRiderWithSession(), mockProfile (+3 more) |
| **security-deposit.spec.ts** | `e2e/security-deposit.spec.ts` | helpers.ts, loginAsRiderWithSession(), securityDepositCard, switchToAdmin() |
| **securityDepositCard** | `e2e/security-deposit.spec.ts` | security-deposit.spec.ts |
| **submitBtn** | `e2e/transactions-extended.spec.ts` | transactions-extended.spec.ts |
| **transactions-extended.spec.ts** | `e2e/transactions-extended.spec.ts` | helpers.ts, loginAsRiderWithSession(), selectRiderApp(), store (+1 more) |
| **topUpBtn** | `e2e/transactions-flow.spec.ts` | transactions-flow.spec.ts |
| **transactions-flow.spec.ts** | `e2e/transactions-flow.spec.ts` | bookVehicleBtn, helpers.ts, loginAsRiderWithSession(), store (+1 more) |
| **bookVehicleBtn** | `e2e/transactions-flow.spec.ts` | transactions-flow.spec.ts |
| **pendingApprTab** | `e2e/wallet-topup.spec.ts` | wallet-topup.spec.ts |
| **wallet-topup.spec.ts** | `e2e/wallet-topup.spec.ts` | approveBtn, helpers.ts, loginAsRiderWithSession(), pendingApprTab (+2 more) |
| **row** | `e2e/wallet-topup.spec.ts` | wallet-topup.spec.ts |
| **wallet_test.dart** | `flutter/integration_test/e2e/wallet_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, navigateToTab (+4 more) |
| **11_wallet_balance_test.dart** | `flutter/integration_test/e2e_individual/11_wallet_balance_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, navigateToTab (+3 more) |
| **12_wallet_topup_test.dart** | `flutter/integration_test/e2e_individual/12_wallet_topup_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, navigateToTab (+6 more) |
| **package:voltium_rider/screens/wallet_screen.dart** | `flutter/integration_test/e2e_individual/12_wallet_topup_test.dart` | 12_wallet_topup_test.dart |
| *And 6 more flows...* | | |


## 📌 Vehicle Assignment, Inspection & Pickup

| Flow / Spec | File Path | Key Graph Connections |
| :--- | :--- | :--- |
| **end-rental.spec.ts** | `e2e/end-rental.spec.ts` | helpers.ts, selectRiderApp(), sessionData |
| **scanBtn** | `e2e/pickup-form.spec.ts` | pickup-form.spec.ts |
| **pickup-form.spec.ts** | `e2e/pickup-form.spec.ts` | helpers.ts, loginAsRiderWithSession(), scanBtn, vehicleText |
| **vehicleText** | `e2e/pickup-form.spec.ts` | pickup-form.spec.ts |
| **27_missing_vehicle_state_test.dart** | `flutter/integration_test/e2e_individual/27_missing_vehicle_state_test.dart` | ../helpers/test_helpers.dart, expectOnDashboard, fullLoginFlow, main (+3 more) |
| **32_rental_end_test.dart** | `flutter/integration_test/e2e_individual/32_rental_end_test.dart` | ../helpers/test_helpers.dart, expectOnDashboard, fullLoginFlow, main (+3 more) |
| **39_vehicle_return_workflow_test.dart** | `flutter/integration_test/e2e_individual/39_vehicle_return_workflow_test.dart` | ../helpers/test_helpers.dart, expectOnDashboard, fullLoginFlow, main (+5 more) |


## 📌 Support Tickets, Incidents & FAQs

| Flow / Spec | File Path | Key Graph Connections |
| :--- | :--- | :--- |
| **support-ticket.spec.ts** | `e2e/support-ticket.spec.ts` | body, descTextarea, helpers.ts, issueDropdown (+5 more) |
| **tickets** | `e2e/support-ticket.spec.ts` | support-ticket.spec.ts |
| **supportNavBtn** | `e2e/support-ticket.spec.ts` | support-ticket.spec.ts |
| **descTextarea** | `e2e/support-ticket.spec.ts` | support-ticket.spec.ts |
| **issueDropdown** | `e2e/support-ticket.spec.ts` | support-ticket.spec.ts |
| **raiseBtn** | `e2e/support-ticket.spec.ts` | support-ticket.spec.ts |
| **goBack** | `flutter/integration_test/e2e/support_test.dart` | support_test.dart |
| **support_test.dart** | `flutter/integration_test/e2e/support_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, goBack, main (+5 more) |
| **20_support_screen_test.dart** | `flutter/integration_test/e2e_individual/20_support_screen_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, navigateToTab (+3 more) |
| **21_support_faq_test.dart** | `flutter/integration_test/e2e_individual/21_support_faq_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, navigateToTab (+3 more) |
| **22_support_chat_test.dart** | `flutter/integration_test/e2e_individual/22_support_chat_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, navigateToTab (+3 more) |
| **23_support_ticket_test.dart** | `flutter/integration_test/e2e_individual/23_support_ticket_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, navigateToTab (+3 more) |
| **support_smoke_test.dart** | `flutter/integration_test/support_smoke_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, navigateToTab (+5 more) |


## 📌 Admin Controls & Operations

| Flow / Spec | File Path | Key Graph Connections |
| :--- | :--- | :--- |
| **admin-crud.spec.ts** | `e2e/admin-crud.spec.ts` | gotoAdminPanel(), helpers.ts, settingsBtn |
| **settingsBtn** | `e2e/admin-crud.spec.ts` | admin-crud.spec.ts |
| **approveBtn** | `e2e/admin-flow.spec.ts` | admin-flow.spec.ts |
| **admin-flow.spec.ts** | `e2e/admin-flow.spec.ts` | approveBtn, dialog, gotoAdminPanel(), helpers.ts (+6 more) |
| **kycBtn** | `e2e/admin-flow.spec.ts` | admin-flow.spec.ts |
| **pendingTab** | `e2e/admin-flow.spec.ts` | admin-flow.spec.ts |
| **kycRow** | `e2e/admin-flow.spec.ts` | admin-flow.spec.ts |
| **txBtn** | `e2e/admin-flow.spec.ts` | admin-flow.spec.ts |
| **pendingTxTab** | `e2e/admin-flow.spec.ts` | admin-flow.spec.ts |
| **pendingRow** | `e2e/admin-flow.spec.ts` | admin-flow.spec.ts |
| **dialog** | `e2e/admin-flow.spec.ts` | admin-flow.spec.ts |
| **admin-live.spec.ts** | `e2e/admin-live.spec.ts` | dashboard, deviceTab, eyeBtn, liveGpsBtn (+3 more) |
| **dashboard** | `e2e/admin-live.spec.ts` | admin-live.spec.ts |
| **loginBtn** | `e2e/admin-live.spec.ts` | admin-live.spec.ts |
| **pingIndicator** | `e2e/admin-live.spec.ts` | admin-live.spec.ts |
| *And 9 more flows...* | | |


## 📌 Rewards, Referrals & Loyalty

| Flow / Spec | File Path | Key Graph Connections |
| :--- | :--- | :--- |
| **referrals.spec.ts** | `e2e/referrals.spec.ts` | helpers.ts, loginAsRiderWithSession(), switchToAdmin(), table |
| **table** | `e2e/referrals.spec.ts` | referrals.spec.ts |
| **sessionData** | `e2e/rewards.spec.ts` | rewards.spec.ts |
| **rewards.spec.ts** | `e2e/rewards.spec.ts` | helpers.ts, selectRiderApp(), sessionData |
| **10_referral_widget_test.dart** | `flutter/integration_test/e2e_individual/10_referral_widget_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, package:flutter/material.dart (+3 more) |
| **29_empty_referral_test.dart** | `flutter/integration_test/e2e_individual/29_empty_referral_test.dart` | ../helpers/test_helpers.dart, fullLoginFlow, main, package:flutter/material.dart (+2 more) |


## 📌 Miscellaneous / Other Tests

| Flow / Spec | File Path | Key Graph Connections |
| :--- | :--- | :--- |
| **auth-flow.spec.ts** | `e2e/auth-flow.spec.ts` | None |
| **body** | `e2e/cross-app-extended.spec.ts` | cross-app-extended.spec.ts |
| **sharedState** | `e2e/cross-app-extended.spec.ts` | cross-app-extended.spec.ts |
| **cross-app-extended.spec.ts** | `e2e/cross-app-extended.spec.ts` | body, getInitialRider(), helpers.ts, hideOverlays() (+7 more) |
| **getInitialRider()** | `e2e/cross-app-extended.spec.ts` | cross-app-extended.spec.ts |
| **tx** | `e2e/cross-app-extended.spec.ts` | cross-app-extended.spec.ts |
| **restoreRider()** | `e2e/cross-app-extended.spec.ts` | cross-app-extended.spec.ts, hideOverlays(), selectRiderApp() |
| **cross-app-sync.spec.ts** | `e2e/cross-app-sync.spec.ts` | body, getInitialRiderState(), handleSupportTicket(), helpers.ts (+10 more) |
| **getInitialRiderState()** | `e2e/cross-app-sync.spec.ts` | cross-app-sync.spec.ts |
| **method** | `e2e/cross-app-sync.spec.ts` | cross-app-sync.spec.ts, handleSupportTicket() |
| **handleSupportTicket()** | `e2e/cross-app-sync.spec.ts` | cross-app-sync.spec.ts, method |
| **riderRow** | `e2e/cross-app-sync.spec.ts` | cross-app-sync.spec.ts |
| **returnCard** | `e2e/cross-app-sync.spec.ts` | cross-app-sync.spec.ts |
| **dashboard-transition.spec.ts** | `e2e/dashboard-transition.spec.ts` | buttons, canvas, captureBtns, completeBtn (+8 more) |
| **currentRider** | `e2e/dashboard-transition.spec.ts` | dashboard-transition.spec.ts |
| *And 76 more flows...* | | |


import os

TEST_BASE = r"d:\voltium\flutter\test"

WIDGETS = [
    {
        "file": "widgets/shimmer_loading_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/shimmer_loading.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('ShimmerLoading widgets golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester, size: const Size(800, 1200));

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: SingleChildScrollView(
          child: Column(
            children: [
              ShimmerLoading(width: 100, height: 20),
              ShimmerCard(width: 200, height: 100),
              ShimmerListTile(),
              ShimmerTransactionCard(),
              ShimmerWalletCard(),
              ShimmerVehicleCard(),
              ShimmerProfileCard(),
              ShimmerKycStep(stepNumber: 1),
              ShimmerDashboardCard(hasChart: true),
              ShimmerText(width: 150),
              ShimmerList(itemCount: 2),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/shimmer_loading_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/shimmer_table_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/shimmer_table.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('ShimmerTable and Grid golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: SingleChildScrollView(
          child: Column(
            children: [
              ShimmerTable(rows: 3, columns: 3),
              SizedBox(height: 500, child: ShimmerGrid(itemCount: 4, crossAxisCount: 2)),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/shimmer_table_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/signature_pad_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/signature_pad.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('SignaturePad golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: SignaturePad(),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/signature_pad_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/skeleton_loader_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/skeleton_loader.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('SkeletonLoader widgets golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester, size: const Size(800, 1000));

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: SingleChildScrollView(
          child: Column(
            children: [
              PlansSkeleton(),
              GuarantorSkeleton(),
              KycSkeleton(),
              NotificationSkeleton(),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/skeleton_loader_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/splash_screen_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/splash_screen.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('SplashScreen golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    await tester.pumpWidget(
      GoldenTestHarness(
        child: Column(
          children: [
            Expanded(child: AnimatedLogoSplash(onComplete: () {})),
            const PulsingBoltLogo(),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/splash_screen_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/styled_scrollbar_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/styled_scrollbar.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('StyledScrollbar golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    final scrollController = ScrollController();
    await tester.pumpWidget(
      GoldenTestHarness(
        child: Stack(
          children: [
            StyledScrollbar(
              controller: scrollController,
              child: ListView.builder(
                controller: scrollController,
                itemCount: 50,
                itemBuilder: (context, index) => Text('Item $index'),
              ),
            ),
            Positioned(
              bottom: 10,
              right: 10,
              child: ScrollToTopButton(controller: scrollController),
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: ScrollIndicator(controller: scrollController),
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/styled_scrollbar_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/swipeable_card_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/swipeable_card.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('SwipeableCard golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    await tester.pumpWidget(
      GoldenTestHarness(
        child: Column(
          children: [
            SwipeableCard(
              onDelete: () {},
              child: const ListTile(title: Text('Swipeable Card')),
            ),
            SwipeAction(
              actions: [
                SwipeActionItem(type: SwipeActionType.delete, onTap: () {}),
                SwipeActionItem(type: SwipeActionType.archive, onTap: () {}),
              ],
              child: const ListTile(title: Text('Swipe Action Card')),
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/swipeable_card_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/theme_icons_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/theme_icons.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('ThemeIcons golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: Column(
          children: [
            ThemeIcon(lightIcon: Icons.sunny, darkIcon: Icons.nightlight),
            StatusBadge(text: 'Active', color: Colors.green),
            StatusBadge(text: 'Inactive', color: Colors.red),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/theme_icons_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/toast_notifications_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/toast_notifications.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('ToastNotifications golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // As AnimatedToast expects toasts to be passed in some way or maybe it observes state.
    // Let's just create the widget with an empty list and a basic child if that is how it's used.
    // Assuming `toasts` is a List of some Toast model. We will pass empty if the model is not clear.
    await tester.pumpWidget(
      const GoldenTestHarness(
        child: AnimatedToast(
          toasts: [],
          child: Text('Content'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/toast_notifications_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/transaction_filter_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/transaction_filter.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('TransactionFilter golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    await tester.pumpWidget(
      GoldenTestHarness(
        child: Column(
          children: [
            TransactionFilterSort(
              selectedSort: 'Date',
              onFilterChanged: (f) {},
              onSortChanged: (s) {},
            ),
            DateRangePicker(
              onChanged: (s, e) {},
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/transaction_filter_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/upload_preview_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/upload_preview.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('UploadPreview golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: Column(
          children: [
            UploadPreview(label: 'Upload Document'),
            FilePreview(filePath: 'test.png'),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/upload_preview_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/wallet_card_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/wallet_card.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('WalletCard golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: Column(
          children: [
            GradientWalletCard(balance: 150.0, name: 'John Doe', vehicleNumber: 'ABC-123'),
            MiniWalletCard(balance: 50.0, label: 'Rewards', icon: Icons.star),
            WalletActionButton(icon: Icons.add, label: 'Top Up'),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/wallet_card_default.png'),
    );
  });
}
"""
    },
    {
        "file": "widgets/web_banner_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/widgets/web_banner.dart';
import '../../helpers/golden_test_harness.dart';
import '../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('WebBanner golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: WebPlatformBanner(),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/web_banner_default.png'),
    );
  });
}
"""
    },
    {
        "file": "features/dashboard/presentation/screens/dashboard_screen_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/features/dashboard/presentation/screens/dashboard_screen.dart';
import '../../../../../helpers/golden_test_harness.dart';
import '../../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('DashboardScreen golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester, size: const Size(400, 800));

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: DashboardScreen(),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/dashboard_screen_default.png'),
    );
  });
}
"""
    },
    {
        "file": "features/wallet/presentation/screens/wallet_screen_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/features/wallet/presentation/screens/wallet_screen.dart';
import '../../../../../helpers/golden_test_harness.dart';
import '../../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('WalletScreen golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester, size: const Size(400, 800));

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: WalletScreen(),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/wallet_screen_default.png'),
    );
  });
}
"""
    },
    {
        "file": "features/profile/presentation/screens/profile_screen_golden_test.dart",
        "content": """import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/features/profile/presentation/screens/profile_screen.dart';
import '../../../../../helpers/golden_test_harness.dart';
import '../../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('ProfileScreen golden test', (WidgetTester tester) async {
    configureGoldenSurface(tester, size: const Size(400, 800));

    await tester.pumpWidget(
      const GoldenTestHarness(
        child: ProfileScreen(),
      ),
    );
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GoldenTestHarness),
      matchesGoldenFile('goldens/profile_screen_default.png'),
    );
  });
}
"""
    }
]

for w in WIDGETS:
    path = os.path.join(TEST_BASE, w["file"])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(w["content"])
    print(f"Created {path}")

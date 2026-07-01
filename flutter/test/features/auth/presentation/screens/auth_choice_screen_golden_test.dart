import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/auth/presentation/screens/auth_choice_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('AuthChoiceScreen golden test', (tester) async {
    await tester.pumpWidget(wrapForGolden(const AuthChoiceScreen()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(AuthChoiceScreen),
      matchesGoldenFile('goldens/auth_choice_screen.png'),
    );
  });
}

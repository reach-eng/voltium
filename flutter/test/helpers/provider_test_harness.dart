import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// A test harness for Riverpod providers that manages a ProviderContainer.
/// Simplifies overriding providers with mocks.
class ProviderTestHarness {
  late ProviderContainer container;

  void setUpContainer({List<Override> overrides = const []}) {
    container = ProviderContainer(overrides: overrides);
  }

  void tearDownContainer() {
    container.dispose();
  }

  /// Reads a provider's current value.
  T read<T>(ProviderListenable<T> provider) {
    return container.read(provider);
  }

  /// Listens to a provider and returns a list of its emitted values over time.
  List<T> listen<T>(ProviderListenable<T> provider) {
    final values = <T>[];
    container.listen<T>(
      provider,
      (previous, next) => values.add(next),
      fireImmediately: true,
    );
    return values;
  }
}

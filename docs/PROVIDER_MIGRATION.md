# Provider to Riverpod Migration Guide

This document outlines the strategy for migrating our Flutter application's state management from `provider` to `flutter_riverpod`.

## Why Migrate?
- **Compile-time Safety**: Riverpod catches `ProviderNotFoundException` at compile time.
- **Global Scope**: Providers can be declared globally, avoiding deep nesting of `ProviderScope`.
- **Better Async Handling**: `AsyncValue` makes handling loading and error states significantly easier than `FutureBuilder` or custom state classes.

## Migration Strategy (Gradual)

We will perform this migration gradually to avoid massive regressions:

1. **Setup Riverpod**:
   Add `flutter_riverpod` to `pubspec.yaml` and wrap the root `App` widget in a `ProviderScope`.

2. **Leaf Nodes First**:
   Identify providers that do not depend on other providers (e.g., ThemeProvider, AuthTokenProvider). Migrate these first to Riverpod.
   - Change `ChangeNotifierProvider` to `StateNotifierProvider` or `NotifierProvider`.

3. **Co-existence**:
   During the migration, both `provider` and `flutter_riverpod` will co-exist.
   Widgets can consume from both simultaneously if needed.

4. **Migrate Consumers**:
   Change `ConsumerWidget` or `context.watch` to Riverpod's `ConsumerWidget` or `ref.watch`.

5. **Complex Inter-dependencies**:
   Once basic providers are migrated, migrate providers that depend on other providers using `ref.watch` instead of `ProxyProvider`.

6. **Cleanup**:
   Once all providers and consumers are migrated, remove the `provider` package from `pubspec.yaml`.

## Examples

### Before (Provider)
```dart
class Counter extends ChangeNotifier {
  int value = 0;
  void increment() {
    value++;
    notifyListeners();
  }
}
// Consumed via context.watch<Counter>()
```

### After (Riverpod)
```dart
final counterProvider = StateNotifierProvider<CounterNotifier, int>((ref) {
  return CounterNotifier();
});

class CounterNotifier extends StateNotifier<int> {
  CounterNotifier() : super(0);
  void increment() => state++;
}
// Consumed via ref.watch(counterProvider)
```

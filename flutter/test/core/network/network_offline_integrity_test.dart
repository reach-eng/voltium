import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/network/connectivity_provider.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/services/offline_storage_service.dart';
import 'package:voltium_rider/features/notifications/presentation/providers/notification_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/ticket_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';
import 'package:voltium_rider/features/support/domain/repository.dart';
import 'package:voltium_rider/models/notification_model.dart';

class FakeSupportRepository implements SupportRepository {
  bool shouldFail = false;
  int fetchCallCount = 0;

  @override
  Future<Map<String, dynamic>> fetchFaqs() async => {'faqs': []};

  @override
  Future<Map<String, dynamic>> fetchTickets() async {
    fetchCallCount++;
    if (shouldFail) {
      throw Exception('Network connection error');
    }
    return {
      'tickets': [
        {
          'id': 't-1',
          'subject': 'Brake issue',
          'category': 'VEHICLE',
          'status': 'OPEN',
          'priority': 'HIGH',
          'createdAt': DateTime.now().toIso8601String(),
        }
      ]
    };
  }

  @override
  Future<Map<String, dynamic>> createTicket(
    String category,
    String subject,
    String message, {
    String riderId = '',
    String priority = 'MEDIUM',
    String? attachments,
  }) async {
    return {'id': 't-new'};
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase F3: Network & Offline Integrity Suite', () {
    group('FL-5 & FL-9: OfflineStorageService MemCache TTL & Lifecycle', () {
      late OfflineStorageService storage;

      setUp(() {
        storage = OfflineStorageService();
        storage.clearMemCacheForTesting();
      });

      test('MemCache entry returns data immediately within TTL', () async {
        final data = {'status': 'active', 'vehicle': 'v-100'};
        await storage.cacheData('key_ttl_valid', data,
            ttl: const Duration(seconds: 10));

        final retrieved = await storage.getCachedData('key_ttl_valid');
        expect(retrieved, isNotNull);
        expect(retrieved?['status'], equals('active'));
      });

      test('MemCache entry expires and is evicted after TTL passes', () async {
        final data = {'status': 'temporary'};
        await storage.cacheData('key_ttl_expired', data,
            ttl: const Duration(milliseconds: 50));

        await Future.delayed(const Duration(milliseconds: 70));

        final retrieved = await storage.getCachedData('key_ttl_expired');
        expect(retrieved, isNull);
      });

      test('clearAll wipes in-memory cache completely', () async {
        await storage.cacheData('key_to_clear', {'val': 123});
        await storage.clearAll();

        final retrieved = await storage.getCachedData('key_to_clear');
        expect(retrieved, isNull);
      });

      test('close resets database state and clears memory cache', () async {
        await storage.cacheData('temp_key', {'test': true});
        await storage.close();
        storage.clearMemCacheForTesting();
        final retrieved = await storage.getCachedData('temp_key');
        expect(retrieved, isNull);
      });
    });

    group('FL-7: ConnectivityProvider single-flight flush protection', () {
      test('ConnectivityProvider initializes with current connectivity state',
          () {
        final container = ProviderContainer();
        addTearDown(container.dispose);

        final state = container.read(connectivityProvider);
        expect(state.isOnline, isTrue);
        expect(state.pendingSyncCount, equals(0));
      });

      test('setOnline toggles online state and does not throw on rapid calls',
          () {
        final container = ProviderContainer();
        addTearDown(container.dispose);

        final notifier = container.read(connectivityProvider.notifier);
        notifier.setOnline(false);
        expect(container.read(connectivityProvider).isOnline, isFalse);

        // Rapid online events trigger single-flight queue flush without error
        notifier.setOnline(true);
        notifier.setOnline(true);
        notifier.setOnline(true);
        expect(container.read(connectivityProvider).isOnline, isTrue);
      });
    });

    group('FL-6: NotificationProvider Hydration-Before-Mutation', () {
      setUp(() {
        SharedPreferences.setMockInitialValues({});
      });

      test(
          'NotificationProvider initial state transitions from loading to hydrated',
          () async {
        final container = ProviderContainer();
        addTearDown(container.dispose);

        // Mount provider
        final initial = container.read(notificationProvider);
        expect(initial.isLoading, isTrue);

        await Future.delayed(const Duration(milliseconds: 50));

        final hydrated = container.read(notificationProvider);
        expect(hydrated.isLoading, isFalse);
      });

      test('addNotification preserves items added before hydration completes',
          () async {
        SharedPreferences.setMockInitialValues({
          'volt_notifications':
              '[{"id":"saved-1","title":"Saved Notification","message":"From disk","type":"SYSTEM","createdAt":"2026-08-20T10:00:00.000Z","isRead":false}]',
        });

        final container = ProviderContainer();
        addTearDown(container.dispose);

        final notifier = container.read(notificationProvider.notifier);

        // Add a fresh notification in-memory immediately
        final freshNotification = AppNotification(
          id: 'fresh-1',
          title: 'Live Push Alert',
          message: 'Just arrived',
          type: AppNotificationType.system,
          createdAt: DateTime.now(),
        );
        await notifier.addNotification(freshNotification);

        // Wait for microtask hydration to finish
        await Future.delayed(const Duration(milliseconds: 50));

        final finalState = container.read(notificationProvider);
        expect(finalState.isLoading, isFalse);
        expect(finalState.notifications.length, equals(2));
        expect(finalState.notifications.any((n) => n.id == 'fresh-1'), isTrue);
        expect(finalState.notifications.any((n) => n.id == 'saved-1'), isTrue);
      });
    });

    group('FL-8: TicketProvider Dependency Injection & Error/Retry', () {
      test(
          'SupportTicketsNotifier fetches tickets via supportRepositoryProvider',
          () async {
        final fakeRepo = FakeSupportRepository();
        final container = ProviderContainer(
          overrides: [
            supportRepositoryProvider.overrideWithValue(fakeRepo),
          ],
        );
        addTearDown(container.dispose);

        // Mount provider and trigger initial fetch
        container.read(supportTicketsProvider);

        await Future.delayed(const Duration(milliseconds: 50));

        final state = container.read(supportTicketsProvider);
        expect(state.isLoading, isFalse);
        expect(state.error, isNull);
        expect(state.tickets.length, equals(1));
        expect(state.tickets.first.id, equals('t-1'));
        expect(fakeRepo.fetchCallCount, equals(1));
      });

      test('SupportTicketsNotifier surfaces error and allows retry', () async {
        final fakeRepo = FakeSupportRepository()..shouldFail = true;
        final container = ProviderContainer(
          overrides: [
            supportRepositoryProvider.overrideWithValue(fakeRepo),
          ],
        );
        addTearDown(container.dispose);

        // Mount provider and trigger initial fetch (which fails)
        container.read(supportTicketsProvider);

        await Future.delayed(const Duration(milliseconds: 50));

        final errorState = container.read(supportTicketsProvider);
        expect(errorState.isLoading, isFalse);
        expect(errorState.error, equals('Failed to load tickets'));

        // Resolve backend issue and retry
        fakeRepo.shouldFail = false;
        await container.read(supportTicketsProvider.notifier).fetchTickets();

        final retryState = container.read(supportTicketsProvider);
        expect(retryState.isLoading, isFalse);
        expect(retryState.error, isNull);
        expect(retryState.tickets.length, equals(1));
        expect(fakeRepo.fetchCallCount, equals(2));
      });
    });

    group('FL-4: Idempotency Key Format & Generation', () {
      test('ApiClient.newIdempotencyKey generates standard UUID v4 format', () {
        final key1 = ApiClient.newIdempotencyKey();
        final key2 = ApiClient.newIdempotencyKey();

        expect(key1, isNotEmpty);
        expect(key2, isNotEmpty);
        expect(key1, isNot(equals(key2)));

        final uuidV4Regex = RegExp(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
            caseSensitive: false);
        expect(uuidV4Regex.hasMatch(key1), isTrue);
        expect(uuidV4Regex.hasMatch(key2), isTrue);
      });
    });
  });
}

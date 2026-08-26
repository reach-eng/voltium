import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/services/emergency_contacts_service.dart';

void main() {
  // R4.3c-2: EmergencyContactsService is now a Riverpod v3 Notifier.
  // Tests use a ProviderContainer to drive the notifier and read
  // its state.
  late ProviderContainer container;
  late EmergencyContactsNotifier service;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    container = ProviderContainer();
    service = container.read(emergencyContactsServiceProvider.notifier);
    // Allow the microtask-scheduled hydration to finish.
    await Future<void>.delayed(Duration.zero);
  });

  tearDown(() {
    container.dispose();
  });

  test('addContact adds to list and marks primary if first', () async {
    final contact = EmergencyContact(
      id: '1',
      name: 'John Doe',
      phone: '1234567890',
      relationship: 'Friend',
    );

    await service.addContact(contact);
    final state = container.read(emergencyContactsServiceProvider);
    expect(state.contacts.length, 1);
    expect(state.contacts.first.isPrimary, isTrue);
    expect(state.primaryContact?.name, 'John Doe');
  });

  test('addContact replaces primary correctly', () async {
    await service.addContact(EmergencyContact(
      id: '1',
      name: 'First',
      phone: '123',
      relationship: 'A',
      isPrimary: true,
    ));
    await service.addContact(EmergencyContact(
      id: '2',
      name: 'Second',
      phone: '456',
      relationship: 'B',
      isPrimary: true,
    ));

    final state = container.read(emergencyContactsServiceProvider);
    expect(state.contacts.length, 2);
    expect(state.primaryContact?.id, '2');
    expect(state.contacts.firstWhere((c) => c.id == '1').isPrimary, isFalse);
  });

  test('addContact throws if more than 5', () async {
    for (int i = 0; i < 5; i++) {
      await service.addContact(EmergencyContact(
        id: i.toString(),
        name: 'Name',
        phone: 'Phone',
        relationship: 'Rel',
      ));
    }
    expect(
      () => service.addContact(EmergencyContact(
        id: '6',
        name: 'Sixth',
        phone: '999',
        relationship: 'X',
      )),
      throwsException,
    );
  });
}

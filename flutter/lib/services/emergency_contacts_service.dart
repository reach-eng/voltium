// R4.3c-2 — Riverpod v3 `EmergencyContactsService`.
//
// The class used to extend `ChangeNotifier`; now it's a Riverpod
// v3 Notifier exposing an immutable `EmergencyContactsState`.
//
// Same surface as before:
//   - `contacts`, `primaryContact`
//   - `addContact`, `updateContact`, `removeContact`,
//     `setPrimaryContact`, `clearAll`
//
// State is hydrated from `SharedPreferences` in `build()` and
// persisted after each mutation. The same
// `volt_emergency_contacts` storage key is used for backward
// compatibility — existing installs keep their cached contacts.

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

@immutable
class EmergencyContact {
  final String id;
  final String name;
  final String phone;
  final String relationship;
  final bool isPrimary;

  const EmergencyContact({
    required this.id,
    required this.name,
    required this.phone,
    required this.relationship,
    this.isPrimary = false,
  });

  EmergencyContact copyWith({
    String? name,
    String? phone,
    String? relationship,
    bool? isPrimary,
  }) {
    return EmergencyContact(
      id: id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      relationship: relationship ?? this.relationship,
      isPrimary: isPrimary ?? this.isPrimary,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'relationship': relationship,
        'isPrimary': isPrimary,
      };

  factory EmergencyContact.fromJson(Map<String, dynamic> json) =>
      EmergencyContact(
        id: json['id'] as String,
        name: json['name'] as String,
        phone: json['phone'] as String,
        relationship: json['relationship'] as String,
        isPrimary: json['isPrimary'] as bool? ?? false,
      );
}

@immutable
class EmergencyContactsState {
  final List<EmergencyContact> contacts;
  const EmergencyContactsState({this.contacts = const []});

  EmergencyContact? get primaryContact {
    if (contacts.isEmpty) return null;
    for (final c in contacts) {
      if (c.isPrimary) return c;
    }
    return contacts.first;
  }

  EmergencyContactsState copyWith({List<EmergencyContact>? contacts}) =>
      EmergencyContactsState(
        contacts: contacts ?? this.contacts,
      );
}

class EmergencyContactsNotifier extends Notifier<EmergencyContactsState> {
  static const String _key = 'volt_emergency_contacts';
  static const int _maxContacts = 5;

  @override
  EmergencyContactsState build() {
    Future.microtask(() => _hydrate());
    return const EmergencyContactsState();
  }

  Future<void> _hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString(_key);
    if (json == null) return;
    try {
      final list = jsonDecode(json) as List;
      final loaded = list
          .map((e) => EmergencyContact.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(contacts: loaded);
    } catch (_) {
      // Corrupt cache; ignore.
    }
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode(state.contacts.map((c) => c.toJson()).toList()),
    );
  }

  Future<void> addContact(EmergencyContact contact) async {
    if (state.contacts.length >= _maxContacts) {
      throw Exception('Maximum $_maxContacts emergency contacts allowed');
    }
    final promoted = contact.isPrimary || state.contacts.isEmpty;
    final added = EmergencyContact(
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      isPrimary: promoted,
    );
    var next = [...state.contacts, added];
    if (promoted) {
      next = [
        for (final c in next)
          if (c.id != added.id && c.isPrimary)
            c.copyWith(isPrimary: false)
          else
            c,
      ];
    }
    state = state.copyWith(contacts: next);
    await _persist();
  }

  Future<void> updateContact(EmergencyContact contact) async {
    final idx = state.contacts.indexWhere((c) => c.id == contact.id);
    if (idx == -1) return;
    final next = [...state.contacts];
    if (contact.isPrimary) {
      for (var i = 0; i < next.length; i++) {
        if (next[i].id != contact.id && next[i].isPrimary) {
          next[i] = next[i].copyWith(isPrimary: false);
        }
      }
    }
    next[idx] = contact;
    state = state.copyWith(contacts: next);
    await _persist();
  }

  Future<void> removeContact(String id) async {
    final next = state.contacts.where((c) => c.id != id).toList();
    if (next.isNotEmpty && next.first.isPrimary == false) {
      next[0] = next[0].copyWith(isPrimary: true);
    }
    state = state.copyWith(contacts: next);
    await _persist();
  }

  Future<void> setPrimaryContact(String id) async {
    final next = [
      for (final c in state.contacts) c.copyWith(isPrimary: c.id == id),
    ];
    state = state.copyWith(contacts: next);
    await _persist();
  }

  Future<void> clearAll() async {
    state = const EmergencyContactsState();
    await _persist();
  }
}

/// Backwards-compat type alias for any code still importing
/// `EmergencyContactsService` as a class.
typedef EmergencyContactsService = EmergencyContactsNotifier;

/// Riverpod v3 provider for emergency contacts.
final emergencyContactsServiceProvider =
    NotifierProvider<EmergencyContactsNotifier, EmergencyContactsState>(
  EmergencyContactsNotifier.new,
);

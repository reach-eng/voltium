import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class EmergencyContact {
  final String id;
  final String name;
  final String phone;
  final String relationship;
  final bool isPrimary;

  EmergencyContact({
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
        id: json['id'],
        name: json['name'],
        phone: json['phone'],
        relationship: json['relationship'],
        isPrimary: json['isPrimary'] ?? false,
      );
}

class EmergencyContactsService extends ChangeNotifier {
  static const String _key = 'volt_emergency_contacts';

  List<EmergencyContact> _contacts = [];
  List<EmergencyContact> get contacts => _contacts;

  EmergencyContact? get primaryContact {
    try {
      return _contacts.firstWhere((c) => c.isPrimary);
    } catch (_) {
      return _contacts.isNotEmpty ? _contacts.first : null;
    }
  }

  EmergencyContactsService();

  Future<void> init() async {
    await _loadContacts();
  }

  Future<void> _loadContacts() async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString(_key);
    if (json != null) {
      try {
        final list = jsonDecode(json) as List;
        _contacts = list
            .map((e) => EmergencyContact.fromJson(e as Map<String, dynamic>))
            .toList();
        notifyListeners();
      } catch (_) {
        _contacts = [];
      }
    }
  }

  Future<void> _saveContacts() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode(_contacts.map((c) => c.toJson()).toList()),
    );
  }

  Future<void> addContact(EmergencyContact contact) async {
    if (_contacts.length >= 5) {
      throw Exception('Maximum 5 emergency contacts allowed');
    }
    final newContact = contact.isPrimary || _contacts.isEmpty
        ? EmergencyContact(
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            relationship: contact.relationship,
            isPrimary: true,
          )
        : contact;
    _contacts.add(newContact);
    if (newContact.isPrimary) {
      _contacts = _contacts.map((c) {
        if (c.id != newContact.id && c.isPrimary) {
          return c.copyWith(isPrimary: false);
        }
        return c;
      }).toList();
    }
    await _saveContacts();
    notifyListeners();
  }

  Future<void> updateContact(EmergencyContact contact) async {
    final index = _contacts.indexWhere((c) => c.id == contact.id);
    if (index != -1) {
      if (contact.isPrimary) {
        _contacts = _contacts.map((c) {
          if (c.id != contact.id && c.isPrimary) {
            return c.copyWith(isPrimary: false);
          }
          return c;
        }).toList();
      }
      _contacts[index] = contact;
      await _saveContacts();
      notifyListeners();
    }
  }

  Future<void> removeContact(String id) async {
    _contacts.removeWhere((c) => c.id == id);
    if (_contacts.isNotEmpty && primaryContact == null) {
      _contacts[0] = _contacts[0].copyWith(isPrimary: true);
    }
    await _saveContacts();
    notifyListeners();
  }

  Future<void> setPrimaryContact(String id) async {
    _contacts = _contacts.map((c) {
      return c.copyWith(isPrimary: c.id == id);
    }).toList();
    await _saveContacts();
    notifyListeners();
  }

  Future<void> clearAll() async {
    _contacts.clear();
    await _saveContacts();
    notifyListeners();
  }
}

import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:sqflite/sqflite.dart';
import 'package:voltium_rider/services/offline_storage_service.dart';

class MockDatabase extends Mock implements Database {}

void main() {
  group('OfflineStorageService Tests with Mocktail', () {
    late MockDatabase mockDb;
    late OfflineStorageService service;

    setUp(() {
      mockDb = MockDatabase();
      service = OfflineStorageService();
      service.dbForTesting = mockDb;
    });

    tearDown(() {
      service.dbForTesting = null;
    });

    test('addPendingOperation inserts record correctly', () async {
      // Arrange
      final endpoint = '/api/kyc';
      final method = 'POST';
      final body = {'aadhaar': '123456789010'};

      when(() => mockDb.insert(
            'pending_operations',
            any(),
            conflictAlgorithm: any(named: 'conflictAlgorithm'),
          )).thenAnswer((_) async => 1);

      // Act
      await service.addPendingOperation(endpoint, method, body);

      // Assert
      verify(() => mockDb.insert(
            'pending_operations',
            any(that: predicate<Map<String, dynamic>>((map) {
              return map['endpoint'] == endpoint &&
                  map['method'] == method &&
                  map['body'] == jsonEncode(body);
            })),
          )).called(1);
    });

    test('getPendingOperations retrieves and maps records correctly', () async {
      // Arrange
      final dbResults = [
        {
          'id': 1,
          'endpoint': '/api/guarantor',
          'method': 'PUT',
          'body': jsonEncode({'name': 'John Doe'}),
          'created_at': 1625000000000,
        }
      ];

      when(() => mockDb.query(
            'pending_operations',
            orderBy: any(named: 'orderBy'),
          )).thenAnswer((_) async => dbResults);

      // Act
      final results = await service.getPendingOperations();

      // Assert
      expect(results.length, 1);
      expect(results.first['id'], 1);
      expect(results.first['endpoint'], '/api/guarantor');
      expect(results.first['method'], 'PUT');
      expect(results.first['body'], equals({'name': 'John Doe'}));
      
      verify(() => mockDb.query(
            'pending_operations',
            orderBy: 'created_at ASC',
          )).called(1);
    });

    test('removePendingOperation deletes correct record', () async {
      // Arrange
      final operationId = 42;
      when(() => mockDb.delete(
            'pending_operations',
            where: any(named: 'where'),
            whereArgs: any(named: 'whereArgs'),
          )).thenAnswer((_) async => 1);

      // Act
      await service.removePendingOperation(operationId);

      // Assert
      verify(() => mockDb.delete(
            'pending_operations',
            where: 'id = ?',
            whereArgs: [operationId],
          )).called(1);
    });
  });
}

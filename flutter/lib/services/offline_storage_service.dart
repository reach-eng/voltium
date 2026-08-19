import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'dart:convert';
import 'monitoring_service.dart';

class OfflineStorageService {
  static final OfflineStorageService _instance =
      OfflineStorageService._internal();
  factory OfflineStorageService() => _instance;
  OfflineStorageService._internal();

  Database? _db;
  bool _initialized = false;

  set dbForTesting(Database? database) => _db = database;

  /// Test-only: the service is a singleton, so the in-memory cache survives
  /// across tests. Tests call this in setUp to avoid cross-test leakage.
  @visibleForTesting
  void clearMemCacheForTesting() => _memCache.clear();

  Future<void> init() async {
    if (_initialized) return;
    final dbPath = await getDatabasesPath();
    _db = await openDatabase(
      join(dbPath, 'volt_offline.db'),
      version: 2,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
    _initialized = true;
    await purgeExpired();
  }

  Future<void> purgeExpired() async {
    if (_db == null) return;
    try {
      final now = DateTime.now().millisecondsSinceEpoch;
      await _db!.delete(
        'cached_data',
        where: 'expires_at IS NOT NULL AND expires_at < ?',
        whereArgs: [now],
      );
    } catch (e) {
      MonitoringService.logError(e, null, reason: 'purgeExpired');
    }
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await db.execute(
        'ALTER TABLE pending_operations ADD COLUMN idempotency_key TEXT',
      );
    }
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE cached_data (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        expires_at INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE pending_operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        body TEXT,
        idempotency_key TEXT,
        created_at INTEGER NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE cached_transactions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE cached_plans (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    ''');
  }

  final Map<String, Map<String, dynamic>> _memCache = {};

  Future<void> cacheData(
    String key,
    Map<String, dynamic> data, {
    Duration? ttl,
  }) async {
    _memCache[key] = data;
    if (_db == null) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    final expiresAt = ttl != null ? now + ttl.inMilliseconds : null;
    await _db!.insert(
      'cached_data',
      {
        'key': key,
        'value': jsonEncode(data),
        'timestamp': now,
        'expires_at': expiresAt,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<Map<String, dynamic>?> getCachedData(String key) async {
    if (_memCache.containsKey(key)) {
      return _memCache[key];
    }
    if (_db == null) return null;
    final now = DateTime.now().millisecondsSinceEpoch;
    final results = await _db!.query(
      'cached_data',
      where: 'key = ? AND (expires_at IS NULL OR expires_at > ?)',
      whereArgs: [key, now],
    );
    if (results.isEmpty) return null;
    final decoded =
        jsonDecode(results.first['value'] as String) as Map<String, dynamic>;
    _memCache[key] = decoded;
    return decoded;
  }

  Future<void> cacheTransactions(
    List<Map<String, dynamic>> transactions,
  ) async {
    if (_db == null) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    final batch = _db!.batch();
    for (final t in transactions) {
      batch.insert(
        'cached_transactions',
        {
          'id': t['id'] ??
              t['transactionId'] ??
              DateTime.now().millisecondsSinceEpoch.toString(),
          'data': jsonEncode(t),
          'timestamp': now,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, dynamic>>> getCachedTransactions() async {
    if (_db == null) return [];
    final results =
        await _db!.query('cached_transactions', orderBy: 'timestamp DESC');
    return results
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }

  Future<void> cachePlans(List<Map<String, dynamic>> plans) async {
    if (_db == null) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    final batch = _db!.batch();
    for (final p in plans) {
      batch.insert(
        'cached_plans',
        {
          'id': p['id'] ??
              p['planId'] ??
              DateTime.now().millisecondsSinceEpoch.toString(),
          'data': jsonEncode(p),
          'timestamp': now,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, dynamic>>> getCachedPlans() async {
    if (_db == null) return [];
    final results = await _db!.query('cached_plans', orderBy: 'timestamp DESC');
    return results
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }

  Future<void> addPendingOperation(
    String endpoint,
    String method,
    Map<String, dynamic>? body, {
    String? idempotencyKey,
  }) async {
    if (_db == null) return;
    MonitoringService.logInfo(
      'Offline: Queuing pending operation: $method $endpoint',
    );
    await _db!.insert('pending_operations', {
      'endpoint': endpoint,
      'method': method,
      'body': body != null ? jsonEncode(body) : null,
      'idempotency_key': idempotencyKey,
      'created_at': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Future<List<Map<String, dynamic>>> getPendingOperations() async {
    if (_db == null) return [];
    final results =
        await _db!.query('pending_operations', orderBy: 'created_at ASC');
    return results
        .map(
          (r) => {
            'id': r['id'],
            'endpoint': r['endpoint'],
            'method': r['method'],
            'body': r['body'] != null ? jsonDecode(r['body'] as String) : null,
            'idempotency_key': r['idempotency_key'],
          },
        )
        .toList();
  }

  Future<void> removePendingOperation(int id) async {
    if (_db == null) return;
    MonitoringService.logInfo('Offline: Sync completed for operation ID $id');
    await _db!.delete('pending_operations', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> clearAll() async {
    if (_db == null) return;
    await _db!.delete('cached_data');
    await _db!.delete('cached_transactions');
    await _db!.delete('cached_plans');
    await _db!.delete('pending_operations');
  }

  Future<void> close() async {
    await _db?.close();
    _initialized = false;
  }
}

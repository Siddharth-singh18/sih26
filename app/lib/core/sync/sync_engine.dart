import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class SyncEngine {
  static final SyncEngine _instance = SyncEngine._internal();
  factory SyncEngine() => _instance;
  SyncEngine._internal();

  Database? _db;

  Future<void> init() async {
    _db = await openDatabase(
      join(await getDatabasesPath(), 'ayusync_offline.db'),
      onCreate: (db, version) {
        return db.execute(
          'CREATE TABLE mutation_queue(id TEXT PRIMARY KEY, entity TEXT, action TEXT, payload TEXT, status TEXT)',
        );
      },
      version: 1,
    );

    Connectivity()
        .onConnectivityChanged
        .listen((List<ConnectivityResult> results) {
      if (!results.contains(ConnectivityResult.none)) {
        syncNow();
      }
    });
  }

  Future<void> queueMutation(String id, String entity, String action,
      Map<String, dynamic> payload) async {
    await _db?.insert(
      'mutation_queue',
      {
        'id': id,
        'entity': entity,
        'action': action,
        'payload': jsonEncode(payload),
        'status': 'PENDING'
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );

    var connectivityResult = await Connectivity().checkConnectivity();

    if (connectivityResult != ConnectivityResult.none) {
      syncNow();
    }
  }

  Future<void> syncNow() async {
    if (_db == null) return;

    final pending = await _db!
        .query('mutation_queue', where: 'status = ?', whereArgs: ['PENDING']);
    if (pending.isEmpty) return;

    try {
      final response = await http.post(
        Uri.parse('http://localhost:5000/api/sync'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'workerId': 'flutter-worker-1',
          'mutations': pending
              .map((p) => {
                    'operationId': p['id'],
                    'entity': p['entity'],
                    'action': p['action'],
                    'payload': jsonDecode(p['payload'] as String),
                  })
              .toList()
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        for (var res in data['results']) {
          if (res['status'] == 'SUCCESS' || res['status'] == 'ALREADY_SYNCED') {
            await _db!.update('mutation_queue', {'status': 'SYNCED'},
                where: 'id = ?', whereArgs: [res['operationId']]);
          }
        }
      }
    } catch (e) {
      print('Sync failed: $e');
    }
  }
}

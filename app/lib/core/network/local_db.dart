import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class LocalDatabase {
  static final LocalDatabase instance = LocalDatabase._init();
  static Database? _database;

  LocalDatabase._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('ayusync.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future _createDB(Database db, int version) async {
    const idType = 'TEXT PRIMARY KEY';
    const textType = 'TEXT NOT NULL';
    const intType = 'INTEGER NOT NULL';
    const boolType = 'BOOLEAN NOT NULL';

    // 18. OFFLINE-FIRST MOBILE ARCHITECTURE
    // Store pending mutations locally
    await db.execute('''
CREATE TABLE sync_queue (
  operationId $idType,
  entityId $textType,
  entity $textType,
  operation $textType,
  payload $textType,
  createdTime $textType,
  retryCount $intType,
  syncStatus $textType
)
''');

    await db.execute('''
CREATE TABLE patients (
  id $idType,
  name $textType,
  age $intType,
  gender $textType,
  isSynced $boolType
)
''');
  }

  Future<void> queueMutation(Map<String, dynamic> mutation) async {
    final db = await instance.database;
    await db.insert('sync_queue', mutation);
  }

  Future<void> close() async {
    final db = await instance.database;
    db.close();
  }
}

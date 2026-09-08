class SyncItem {
  final String id;
  final String entityType; // PATIENT, ASSESSMENT, REFERRAL, FOLLOW_UP
  final String action; // CREATE, UPDATE
  final String description;
  final DateTime createdAt;
  final String status; // PENDING, SYNCING, SYNCED, FAILED

  SyncItem({
    required this.id,
    required this.entityType,
    required this.action,
    required this.description,
    DateTime? createdAt,
    this.status = 'PENDING',
  }) : createdAt = createdAt ?? DateTime.now();

  SyncItem copyWith({
    String? status,
  }) {
    return SyncItem(
      id: id,
      entityType: entityType,
      action: action,
      description: description,
      createdAt: createdAt,
      status: status ?? this.status,
    );
  }
}

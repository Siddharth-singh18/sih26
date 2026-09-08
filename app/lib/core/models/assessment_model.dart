class Vitals {
  final double? temperature;
  final int? systolicBp;
  final int? diastolicBp;
  final int? pulseRate;
  final int? spo2;
  final double? bloodGlucose;
  final int? respiratoryRate;
  final double? weight;

  Vitals({
    this.temperature,
    this.systolicBp,
    this.diastolicBp,
    this.pulseRate,
    this.spo2,
    this.bloodGlucose,
    this.respiratoryRate,
    this.weight,
  });

  Map<String, dynamic> toMap() {
    return {
      'temperature': temperature,
      'systolicBp': systolicBp,
      'diastolicBp': diastolicBp,
      'pulseRate': pulseRate,
      'spo2': spo2,
      'bloodGlucose': bloodGlucose,
      'respiratoryRate': respiratoryRate,
      'weight': weight,
    };
  }

  factory Vitals.fromMap(Map<String, dynamic> map) {
    return Vitals(
      temperature: (map['temperature'] as num?)?.toDouble(),
      systolicBp: map['systolicBp'] as int?,
      diastolicBp: map['diastolicBp'] as int?,
      pulseRate: map['pulseRate'] as int?,
      spo2: map['spo2'] as int?,
      bloodGlucose: (map['bloodGlucose'] as num?)?.toDouble(),
      respiratoryRate: map['respiratoryRate'] as int?,
      weight: (map['weight'] as num?)?.toDouble(),
    );
  }
}

class Assessment {
  final String id;
  final String patientId;
  final String primarySymptom;
  final String severity; // LOW, MODERATE, CRITICAL / SEVERE
  final int durationDays;
  final Vitals vitals;
  final String? primaryHealthConcern;
  final String? relevantObservations;
  final String? clinicalNotes;
  final DateTime timestamp;
  final bool isSynced;

  Assessment({
    required this.id,
    required this.patientId,
    required this.primarySymptom,
    required this.severity,
    required this.durationDays,
    required this.vitals,
    this.primaryHealthConcern,
    this.relevantObservations,
    this.clinicalNotes,
    DateTime? timestamp,
    this.isSynced = true,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'patientId': patientId,
      'primarySymptom': primarySymptom,
      'severity': severity,
      'durationDays': durationDays,
      'vitals': vitals.toMap(),
      'primaryHealthConcern': primaryHealthConcern ?? '',
      'relevantObservations': relevantObservations ?? '',
      'clinicalNotes': clinicalNotes ?? '',
      'timestamp': timestamp.toIso8601String(),
      'isSynced': isSynced ? 1 : 0,
    };
  }

  factory Assessment.fromMap(Map<String, dynamic> map) {
    return Assessment(
      id: map['id'] ?? '',
      patientId: map['patientId'] ?? '',
      primarySymptom: map['primarySymptom'] ?? '',
      severity: map['severity'] ?? 'LOW',
      durationDays: map['durationDays'] ?? 1,
      vitals: map['vitals'] != null
          ? Vitals.fromMap(Map<String, dynamic>.from(map['vitals']))
          : Vitals(),
      primaryHealthConcern: map['primaryHealthConcern'],
      relevantObservations: map['relevantObservations'],
      clinicalNotes: map['clinicalNotes'],
      timestamp: map['timestamp'] != null
          ? DateTime.tryParse(map['timestamp']) ?? DateTime.now()
          : DateTime.now(),
      isSynced: map['isSynced'] == 1 || map['isSynced'] == true,
    );
  }
}

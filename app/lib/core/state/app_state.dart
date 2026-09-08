import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/patient_model.dart';
import '../models/assessment_model.dart';
import '../models/triage_model.dart';
import '../models/facility_model.dart';
import '../models/followup_model.dart';
import '../models/sync_item_model.dart';

class AppState extends ChangeNotifier {
  final _uuid = const Uuid();

  // Network Connectivity State (Toggleable in UI for testing flows)
  bool _isOnline = true;
  bool get isOnline => _isOnline;

  // Logged in worker info
  String _workerName = 'Kavita Devi';
  String _workerId = 'ASHA-CG-4902';
  String _workerCenter = 'Phulgaon Sub-Centre';
  bool _isLoggedIn = false;

  String get workerName => _workerName;
  String get workerId => _workerId;
  String get workerCenter => _workerCenter;
  bool get isLoggedIn => _isLoggedIn;

  // Local Patients List
  final List<Patient> _patients = [
    Patient(
      id: 'P-101',
      name: 'Ramesh Patel',
      age: 48,
      gender: 'Male',
      phone: '+91 98234 11223',
      village: 'Rampur',
      abhaId: '91-4829-1029-4821',
      bloodGroup: 'B+',
      createdAt: DateTime.now().subtract(const Duration(days: 14)),
      isSynced: true,
    ),
    Patient(
      id: 'P-102',
      name: 'Pooja Bai',
      age: 27,
      gender: 'Female',
      phone: '+91 94112 33445',
      village: 'Gopalpur',
      abhaId: '91-3312-9901-4412',
      bloodGroup: 'O+',
      createdAt: DateTime.now().subtract(const Duration(days: 5)),
      isSynced: true,
    ),
    Patient(
      id: 'P-103',
      name: 'Lakhanlal Sahu',
      age: 62,
      gender: 'Male',
      phone: '+91 97723 55667',
      village: 'Rampur',
      abhaId: '91-1122-8877-6655',
      bloodGroup: 'A+',
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
      isSynced: true,
    ),
  ];
  List<Patient> get patients => List.unmodifiable(_patients);

  // Assessments History Map: patientId -> List<Assessment>
  final Map<String, List<Assessment>> _patientAssessments = {
    'P-101': [
      Assessment(
        id: 'ASM-001',
        patientId: 'P-101',
        primarySymptom: 'Chest tightness & Mild shortness of breath',
        severity: 'MODERATE',
        durationDays: 3,
        vitals: Vitals(
          temperature: 98.6,
          systolicBp: 148,
          diastolicBp: 95,
          pulseRate: 88,
          spo2: 96,
          bloodGlucose: 140,
        ),
        clinicalNotes: 'Known hypertensive patient. Missed medication for 2 days.',
        timestamp: DateTime.now().subtract(const Duration(days: 14)),
      ),
    ],
    'P-103': [
      Assessment(
        id: 'ASM-002',
        patientId: 'P-103',
        primarySymptom: 'High grade fever with chills & cough',
        severity: 'SEVERE',
        durationDays: 4,
        vitals: Vitals(
          temperature: 102.4,
          systolicBp: 110,
          diastolicBp: 72,
          pulseRate: 104,
          spo2: 93,
        ),
        clinicalNotes: 'Suspected respiratory infection / Pneumonia.',
        timestamp: DateTime.now().subtract(const Duration(days: 1)),
      ),
    ],
  };

  // Follow-up Counter-Referral Tasks
  final List<FollowUpTask> _followUpTasks = [
    FollowUpTask(
      id: 'TASK-501',
      patientId: 'P-101',
      patientName: 'Ramesh Patel',
      patientPhone: '+91 98234 11223',
      doctorName: 'Dr. Alok Verma (MD Internal Med)',
      doctorFacility: 'Bilaspur PHC',
      taskDescription: 'Post-hypertension blood pressure monitoring & Amlodipine compliance check',
      instructions: 'Record BP sitting and standing. Ensure patient takes Amlodipine 5mg once daily at morning.',
      prescribedMedicines: ['Tab. Amlodipine 5mg (1-0-0)', 'Tab. Paracetamol 500mg SOS'],
      dueDate: DateTime.now().add(const Duration(days: 1)),
      status: 'PENDING',
    ),
    FollowUpTask(
      id: 'TASK-502',
      patientId: 'P-102',
      patientName: 'Pooja Bai',
      patientPhone: '+91 94112 33445',
      doctorName: 'Dr. Meenakshi Soni (OBGYN)',
      doctorFacility: 'Raigarh CHC',
      taskDescription: 'Post-natal checkup (Day 14) & Infant weight check',
      instructions: 'Check maternal hemoglobin levels, temperature, and verify exclusive breastfeeding.',
      prescribedMedicines: ['Tab. IFA (Iron Folic Acid) 1 daily', 'Tab. Calcium 500mg'],
      dueDate: DateTime.now().subtract(const Duration(days: 1)),
      status: 'OVERDUE',
    ),
  ];
  List<FollowUpTask> get followUpTasks => List.unmodifiable(_followUpTasks);

  // Available Health Facilities for Smart Routing
  final List<Facility> _facilities = [
    Facility(
      id: 'FAC-01',
      name: 'Rampur Sub-Health Centre',
      type: 'Sub-Center',
      distanceKm: 0.8,
      readinessScore: 78,
      hasSpecialist: false,
      hasEmergency: false,
      availableBeds: 2,
      waitingMinutes: 10,
      availableServices: ['Basic Triage', 'NCD Screening', 'First Aid', 'Immunization'],
      freshness: 'Updated 5m ago',
    ),
    Facility(
      id: 'FAC-02',
      name: 'Bilaspur Primary Health Centre (PHC)',
      type: 'Primary Health Centre (PHC)',
      distanceKm: 6.5,
      readinessScore: 92,
      hasSpecialist: true,
      hasEmergency: true,
      availableBeds: 12,
      waitingMinutes: 25,
      availableServices: ['General Medicine', 'MBS Doctor', 'Basic Diagnostics', 'Pharmacy', 'Emergency 24x7'],
      freshness: 'Updated 2m ago',
    ),
    Facility(
      id: 'FAC-03',
      name: 'Raigarh Community Health Centre (CHC)',
      type: 'Community Health Centre (CHC)',
      distanceKm: 18.2,
      readinessScore: 89,
      hasSpecialist: true,
      hasEmergency: true,
      availableBeds: 30,
      waitingMinutes: 40,
      availableServices: ['OBGYN', 'Pediatrics', 'General Surgery', 'X-Ray & Lab', 'Inpatient Ward'],
      freshness: 'Updated 8m ago',
    ),
    Facility(
      id: 'FAC-04',
      name: 'District Hospital Bilaspur',
      type: 'District Hospital',
      distanceKm: 34.0,
      readinessScore: 96,
      hasSpecialist: true,
      hasEmergency: true,
      availableBeds: 150,
      waitingMinutes: 60,
      availableServices: ['ICU', 'Cardiology', 'Pulmonology', 'Trauma Center', 'Blood Bank', 'CT Scan'],
      freshness: 'Updated 1m ago',
    ),
  ];
  List<Facility> get facilities => List.unmodifiable(_facilities);

  // Offline Sync Queue
  final List<SyncItem> _syncQueue = [];
  List<SyncItem> get syncQueue => List.unmodifiable(_syncQueue);

  // Active Flow Working Variables
  Patient? _currentPatient;
  Assessment? _currentAssessment;
  TriageResult? _currentTriageResult;
  Facility? _selectedFacility;
  ReferralCase? _lastSubmittedCase;

  Patient? get currentPatient => _currentPatient;
  Assessment? get currentAssessment => _currentAssessment;
  TriageResult? get currentTriageResult => _currentTriageResult;
  Facility? get selectedFacility => _selectedFacility;
  ReferralCase? get lastSubmittedCase => _lastSubmittedCase;

  // Actions & Methods

  void toggleOnlineStatus() {
    _isOnline = !_isOnline;
    notifyListeners();
  }

  void login(String workerId, String pin) {
    _workerId = workerId.isEmpty ? 'ASHA-CG-4902' : workerId;
    _isLoggedIn = true;
    notifyListeners();
  }

  void logout() {
    _isLoggedIn = false;
    notifyListeners();
  }

  void setCurrentPatient(Patient patient) {
    _currentPatient = patient;
    notifyListeners();
  }

  Patient registerPatient({
    required String name,
    required int age,
    required String gender,
    required String phone,
    required String village,
    String? abhaId,
    String? bloodGroup,
  }) {
    final newPatient = Patient(
      id: 'P-${100 + _patients.length + 1}',
      name: name,
      age: age,
      gender: gender,
      phone: phone,
      village: village,
      abhaId: (abhaId != null && abhaId.isNotEmpty) ? abhaId : '91-${_uuid.v4().substring(0, 4)}-${_uuid.v4().substring(0, 4)}',
      bloodGroup: bloodGroup,
      isSynced: _isOnline,
    );

    _patients.insert(0, newPatient);
    _currentPatient = newPatient;

    if (!_isOnline) {
      _syncQueue.add(SyncItem(
        id: _uuid.v4(),
        entityType: 'PATIENT',
        action: 'CREATE',
        description: 'New Patient Registration: ${newPatient.name} (${newPatient.village})',
      ));
    }

    notifyListeners();
    return newPatient;
  }

  List<Assessment> getAssessmentsForPatient(String patientId) {
    return _patientAssessments[patientId] ?? [];
  }

  Assessment createAssessment({
    required String patientId,
    required String primarySymptom,
    required String severity,
    required int durationDays,
    required Vitals vitals,
    String? clinicalNotes,
  }) {
    final assessment = Assessment(
      id: 'ASM-${100 + (_patientAssessments[patientId]?.length ?? 0) + 1}',
      patientId: patientId,
      primarySymptom: primarySymptom,
      severity: severity,
      durationDays: durationDays,
      vitals: vitals,
      clinicalNotes: clinicalNotes,
      isSynced: _isOnline,
    );

    if (!_patientAssessments.containsKey(patientId)) {
      _patientAssessments[patientId] = [];
    }
    _patientAssessments[patientId]!.insert(0, assessment);
    _currentAssessment = assessment;

    // Run AI Triage engine calculations
    _currentTriageResult = _computeTriage(assessment);

    if (!_isOnline) {
      _syncQueue.add(SyncItem(
        id: _uuid.v4(),
        entityType: 'ASSESSMENT',
        action: 'CREATE',
        description: 'Vitals & Assessment: $primarySymptom (Severity: $severity)',
      ));
    }

    notifyListeners();
    return assessment;
  }

  TriageResult _computeTriage(Assessment asm) {
    int score = 25;
    List<String> drivers = [];
    String urgency = 'ROUTINE';
    String action = 'Standard outpatient consultation at Sub-Centre / PHC.';
    String reason = 'Patient presents with mild or routine symptoms with normal baseline vitals.';

    // Evaluate symptoms & vitals against clinical rules
    if (asm.severity == 'SEVERE') {
      score += 40;
      drivers.add('High symptom severity declared (${asm.primarySymptom})');
    } else if (asm.severity == 'MODERATE') {
      score += 20;
      drivers.add('Moderate symptom progression over ${asm.durationDays} days');
    }

    if (asm.vitals.spo2 != null && asm.vitals.spo2! < 94) {
      score += 35;
      drivers.add('Hypoxia: Low Oxygen Saturation (SpO2 ${asm.vitals.spo2}%)');
    }

    if (asm.vitals.systolicBp != null && (asm.vitals.systolicBp! > 160 || asm.vitals.systolicBp! < 90)) {
      score += 25;
      drivers.add('Abnormal Blood Pressure (${asm.vitals.systolicBp}/${asm.vitals.diastolicBp ?? 0} mmHg)');
    }

    if (asm.vitals.temperature != null && asm.vitals.temperature! > 101.5) {
      score += 20;
      drivers.add('High grade pyrexia (${asm.vitals.temperature}°F)');
    }

    if (asm.vitals.pulseRate != null && (asm.vitals.pulseRate! > 110 || asm.vitals.pulseRate! < 50)) {
      score += 15;
      drivers.add('Tachycardia / Bradycardia (${asm.vitals.pulseRate} bpm)');
    }

    if (score >= 70) {
      urgency = 'URGENT';
      action = 'Immediate stabilization and expedited referral to 24x7 PHC / CHC Emergency.';
      reason = 'Critical risk factors detected: ${drivers.join(", ")}. Requires prompt medical evaluation.';
    } else if (score >= 45) {
      urgency = 'PRIORITY';
      action = 'Same-day consultation at Primary Health Centre (PHC). Continuous vitals monitoring.';
      reason = 'Elevated clinical risk due to: ${drivers.join(", ")}. Doctor consultation recommended.';
    }

    return TriageResult(
      assessmentId: asm.id,
      urgencyLevel: urgency,
      urgencyScore: score.clamp(0, 100),
      contributingFactors: drivers.isEmpty ? ['Standard vitals within acceptable ranges'] : drivers,
      recommendedAction: action,
      explanationText: reason,
      confirmedUrgency: urgency,
    );
  }

  void updateWorkerTriageConfirmation({required String confirmedUrgency, String? notes}) {
    if (_currentTriageResult != null) {
      _currentTriageResult = _currentTriageResult!.copyWith(
        confirmedUrgency: confirmedUrgency,
        workerNotes: notes,
      );
      notifyListeners();
    }
  }

  void selectFacility(Facility facility) {
    _selectedFacility = facility;
    notifyListeners();
  }

  ReferralCase submitReferralCase() {
    final patient = _currentPatient ?? _patients.first;
    final facility = _selectedFacility ?? _facilities[1];
    final urgency = _currentTriageResult?.confirmedUrgency ?? _currentTriageResult?.urgencyLevel ?? 'PRIORITY';
    final complaint = _currentAssessment?.primarySymptom ?? 'General clinical consultation';

    final referral = ReferralCase(
      referralId: 'REF-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
      patientId: patient.id,
      patientName: patient.name,
      triageUrgency: urgency,
      facility: facility,
      chiefComplaint: complaint,
    );

    _lastSubmittedCase = referral;

    if (!_isOnline) {
      _syncQueue.add(SyncItem(
        id: _uuid.v4(),
        entityType: 'REFERRAL',
        action: 'CREATE',
        description: 'Referral to ${facility.name} for ${patient.name} (Urgency: $urgency)',
      ));
    }

    notifyListeners();
    return referral;
  }

  void completeFollowUpTask({
    required String taskId,
    required String visitNotes,
    Vitals? recordedVitals,
  }) {
    final index = _followUpTasks.indexWhere((t) => t.id == taskId);
    if (index != -1) {
      final task = _followUpTasks[index];
      _followUpTasks[index] = task.copyWith(
        status: 'COMPLETED',
        visitNotes: visitNotes,
        completedAt: DateTime.now(),
      );

      if (!_isOnline) {
        _syncQueue.add(SyncItem(
          id: _uuid.v4(),
          entityType: 'FOLLOW_UP',
          action: 'UPDATE',
          description: 'Completed Visit for ${task.patientName}: $visitNotes',
        ));
      }

      notifyListeners();
    }
  }

  Future<void> syncAllQueueItems() async {
    for (int i = 0; i < _syncQueue.length; i++) {
      _syncQueue[i] = _syncQueue[i].copyWith(status: 'SYNCING');
    }
    notifyListeners();

    await Future.delayed(const Duration(seconds: 1));

    for (int i = 0; i < _syncQueue.length; i++) {
      _syncQueue[i] = _syncQueue[i].copyWith(status: 'SYNCED');
    }
    notifyListeners();

    await Future.delayed(const Duration(milliseconds: 500));
    _syncQueue.clear();
    notifyListeners();
  }

  List<Patient> searchPatients(String query) {
    if (query.trim().isEmpty) return _patients;
    final q = query.toLowerCase();
    return _patients.where((p) {
      return p.name.toLowerCase().contains(q) ||
          p.phone.contains(q) ||
          p.village.toLowerCase().contains(q) ||
          (p.abhaId?.toLowerCase().contains(q) ?? false);
    }).toList();
  }
}

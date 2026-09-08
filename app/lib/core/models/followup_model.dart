class FollowUpTask {
  final String id;
  final String patientId;
  final String patientName;
  final String patientPhone;
  final String doctorName;
  final String doctorFacility;
  final String taskDescription;
  final String instructions;
  final List<String> prescribedMedicines;
  final DateTime dueDate;
  final String status; // PENDING, OVERDUE, COMPLETED
  final String? visitNotes;
  final DateTime? completedAt;

  FollowUpTask({
    required this.id,
    required this.patientId,
    required this.patientName,
    required this.patientPhone,
    required this.doctorName,
    required this.doctorFacility,
    required this.taskDescription,
    required this.instructions,
    required this.prescribedMedicines,
    required this.dueDate,
    this.status = 'PENDING',
    this.visitNotes,
    this.completedAt,
  });

  FollowUpTask copyWith({
    String? status,
    String? visitNotes,
    DateTime? completedAt,
  }) {
    return FollowUpTask(
      id: id,
      patientId: patientId,
      patientName: patientName,
      patientPhone: patientPhone,
      doctorName: doctorName,
      doctorFacility: doctorFacility,
      taskDescription: taskDescription,
      instructions: instructions,
      prescribedMedicines: prescribedMedicines,
      dueDate: dueDate,
      status: status ?? this.status,
      visitNotes: visitNotes ?? this.visitNotes,
      completedAt: completedAt ?? this.completedAt,
    );
  }
}

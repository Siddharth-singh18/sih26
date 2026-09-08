class Facility {
  final String id;
  final String name;
  final String type; // Sub-Center, PHC, CHC, District Hospital
  final double distanceKm;
  final int readinessScore; // 0 to 100
  final bool hasSpecialist;
  final bool hasEmergency;
  final int availableBeds;
  final int waitingMinutes;
  final List<String> availableServices;
  final String freshness; // e.g. "Updated 10m ago"

  Facility({
    required this.id,
    required this.name,
    required this.type,
    required this.distanceKm,
    required this.readinessScore,
    required this.hasSpecialist,
    required this.hasEmergency,
    required this.availableBeds,
    required this.waitingMinutes,
    required this.availableServices,
    required this.freshness,
  });
}

class ReferralCase {
  final String referralId;
  final String patientId;
  final String patientName;
  final String triageUrgency;
  final Facility facility;
  final String chiefComplaint;
  final DateTime submittedAt;
  final String status; // SUBMITTED, ACCEPTED, SCHEDULED, IN_CONSULTATION, COMPLETED

  ReferralCase({
    required this.referralId,
    required this.patientId,
    required this.patientName,
    required this.triageUrgency,
    required this.facility,
    required this.chiefComplaint,
    DateTime? submittedAt,
    this.status = 'SUBMITTED',
  }) : submittedAt = submittedAt ?? DateTime.now();
}

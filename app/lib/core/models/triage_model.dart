class TriageResult {
  final String assessmentId;
  final String urgencyLevel; // ROUTINE, PRIORITY, URGENT
  final int urgencyScore; // 0 to 100
  final List<String> contributingFactors;
  final String recommendedAction;
  final String explanationText;
  final String? confirmedUrgency; // Worker confirmed or overridden
  final String? workerNotes;

  TriageResult({
    required this.assessmentId,
    required this.urgencyLevel,
    required this.urgencyScore,
    required this.contributingFactors,
    required this.recommendedAction,
    required this.explanationText,
    this.confirmedUrgency,
    this.workerNotes,
  });

  TriageResult copyWith({
    String? confirmedUrgency,
    String? workerNotes,
  }) {
    return TriageResult(
      assessmentId: assessmentId,
      urgencyLevel: urgencyLevel,
      urgencyScore: urgencyScore,
      contributingFactors: contributingFactors,
      recommendedAction: recommendedAction,
      explanationText: explanationText,
      confirmedUrgency: confirmedUrgency ?? this.confirmedUrgency,
      workerNotes: workerNotes ?? this.workerNotes,
    );
  }
}

class Patient {
  final String id;
  final String name;
  final int age;
  final String gender;
  final String phone;
  final String village;
  final String? abhaId;
  final String? bloodGroup;
  final String? dob;
  final String? emergencyContact;
  final String? preferredLanguage;
  final String? district;
  final String? state;
  final String? pinCode;
  final String? address;
  final String? allergies;
  final String? existingConditions;
  final String? currentMedications;
  final String? pastHistory;
  final DateTime createdAt;
  final bool isSynced;

  Patient({
    required this.id,
    required this.name,
    required this.age,
    required this.gender,
    required this.phone,
    required this.village,
    this.abhaId,
    this.bloodGroup,
    this.dob,
    this.emergencyContact,
    this.preferredLanguage,
    this.district,
    this.state,
    this.pinCode,
    this.address,
    this.allergies,
    this.existingConditions,
    this.currentMedications,
    this.pastHistory,
    DateTime? createdAt,
    this.isSynced = true,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'age': age,
      'gender': gender,
      'phone': phone,
      'village': village,
      'abhaId': abhaId ?? '',
      'bloodGroup': bloodGroup ?? '',
      'dob': dob ?? '',
      'emergencyContact': emergencyContact ?? '',
      'preferredLanguage': preferredLanguage ?? '',
      'district': district ?? '',
      'state': state ?? '',
      'pinCode': pinCode ?? '',
      'address': address ?? '',
      'allergies': allergies ?? '',
      'existingConditions': existingConditions ?? '',
      'currentMedications': currentMedications ?? '',
      'pastHistory': pastHistory ?? '',
      'createdAt': createdAt.toIso8601String(),
      'isSynced': isSynced ? 1 : 0,
    };
  }

  factory Patient.fromMap(Map<String, dynamic> map) {
    return Patient(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      age: map['age'] is int ? map['age'] : int.tryParse(map['age'].toString()) ?? 0,
      gender: map['gender'] ?? 'Other',
      phone: map['phone'] ?? '',
      village: map['village'] ?? '',
      abhaId: map['abhaId'] != '' ? map['abhaId'] : null,
      bloodGroup: map['bloodGroup'] != '' ? map['bloodGroup'] : null,
      dob: map['dob'] != '' ? map['dob'] : null,
      emergencyContact: map['emergencyContact'] != '' ? map['emergencyContact'] : null,
      preferredLanguage: map['preferredLanguage'] != '' ? map['preferredLanguage'] : null,
      district: map['district'] != '' ? map['district'] : null,
      state: map['state'] != '' ? map['state'] : null,
      pinCode: map['pinCode'] != '' ? map['pinCode'] : null,
      address: map['address'] != '' ? map['address'] : null,
      allergies: map['allergies'] != '' ? map['allergies'] : null,
      existingConditions: map['existingConditions'] != '' ? map['existingConditions'] : null,
      currentMedications: map['currentMedications'] != '' ? map['currentMedications'] : null,
      pastHistory: map['pastHistory'] != '' ? map['pastHistory'] : null,
      createdAt: map['createdAt'] != null
          ? DateTime.tryParse(map['createdAt']) ?? DateTime.now()
          : DateTime.now(),
      isSynced: map['isSynced'] == 1 || map['isSynced'] == true,
    );
  }

  Patient copyWith({
    String? id,
    String? name,
    int? age,
    String? gender,
    String? phone,
    String? village,
    String? abhaId,
    String? bloodGroup,
    String? dob,
    String? emergencyContact,
    String? preferredLanguage,
    String? district,
    String? state,
    String? pinCode,
    String? address,
    String? allergies,
    String? existingConditions,
    String? currentMedications,
    String? pastHistory,
    DateTime? createdAt,
    bool? isSynced,
  }) {
    return Patient(
      id: id ?? this.id,
      name: name ?? this.name,
      age: age ?? this.age,
      gender: gender ?? this.gender,
      phone: phone ?? this.phone,
      village: village ?? this.village,
      abhaId: abhaId ?? this.abhaId,
      bloodGroup: bloodGroup ?? this.bloodGroup,
      dob: dob ?? this.dob,
      emergencyContact: emergencyContact ?? this.emergencyContact,
      preferredLanguage: preferredLanguage ?? this.preferredLanguage,
      district: district ?? this.district,
      state: state ?? this.state,
      pinCode: pinCode ?? this.pinCode,
      address: address ?? this.address,
      allergies: allergies ?? this.allergies,
      existingConditions: existingConditions ?? this.existingConditions,
      currentMedications: currentMedications ?? this.currentMedications,
      pastHistory: pastHistory ?? this.pastHistory,
      createdAt: createdAt ?? this.createdAt,
      isSynced: isSynced ?? this.isSynced,
    );
  }
}

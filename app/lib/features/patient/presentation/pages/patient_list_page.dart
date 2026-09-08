import 'package:flutter/material.dart';

class PatientListPage extends StatefulWidget {
  const PatientListPage({super.key});

  @override
  State<PatientListPage> createState() => _PatientListPageState();
}

class _PatientListPageState extends State<PatientListPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Patients'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: () {
              // TODO: Trigger Sync
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: SearchBar(
              hintText: 'Search patients locally...',
              leading: const Icon(Icons.search),
              onChanged: (value) {
                // TODO: Offline search logic
              },
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: 3, // Mock data
              itemBuilder: (context, index) {
                return ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: Text('Patient ${index + 1}'),
                  subtitle: const Text('Last assessed: 2 days ago'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    // Navigate to profile
                  },
                );
              },
            ),
          )
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          // Navigate to register
        },
        label: const Text('Register Patient'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

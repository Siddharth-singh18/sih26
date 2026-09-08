


export default function AssessmentView() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <h2 className="text-2xl font-bold tracking-tight mb-6">Patient Assessment</h2>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Vitals Card */}
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Vitals</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Temperature</p>
              <p className="font-medium text-lg">99.1 °F</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SpO2</p>
              <p className="font-medium text-lg">98 %</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Heart Rate</p>
              <p className="font-medium text-lg">82 bpm</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Recorded by: Worker ASHA_01 (10 mins ago)</p>
        </div>

        {/* Symptoms Card */}
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Reported Symptoms</h3>
          <ul className="space-y-2">
            <li className="flex justify-between border-b pb-2">
              <span className="font-medium">Fever</span>
              <span className="text-sm text-muted-foreground">Duration: 2 days | Severity: MODERATE</span>
            </li>
            <li className="flex justify-between border-b pb-2">
              <span className="font-medium">Cough</span>
              <span className="text-sm text-muted-foreground">Duration: 1 day | Severity: MILD</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

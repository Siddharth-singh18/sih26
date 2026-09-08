

const steps = [
  { id: 'CREATED', label: 'Created' },
  { id: 'SUBMITTED', label: 'Submitted' },
  { id: 'ACCEPTED', label: 'Accepted by Facility' },
  { id: 'SCHEDULED', label: 'Scheduled' },
  { id: 'IN_CONSULTATION', label: 'In Consultation' },
  { id: 'COUNTER_REFERRED', label: 'Counter-Referred' },
  { id: 'COMPLETED', label: 'Closed Loop' }
];

interface TrackerProps {
  currentStatus: string;
}

export default function ReferralStatusTracker({ currentStatus }: TrackerProps) {
  // Simple heuristic for linear progress visual
  const currentIndex = steps.findIndex(s => s.id === currentStatus);

  return (
    <div className="w-full py-6">
      <h3 className="text-lg font-bold mb-4">Referral State Machine</h3>
      <div className="flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -z-10 -translate-y-1/2"></div>
        
        {/* Progress line */}
        <div 
          className="absolute top-1/2 left-0 h-1 bg-primary -z-10 -translate-y-1/2 transition-all duration-500"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${isCurrent ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' 
                    : isCompleted ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'}`}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <span className={`text-xs ${isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

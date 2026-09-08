import { useState } from 'react';
import { Button } from '../components/ui/Button';

export default function DemoFlow() {
  const [step, setStep] = useState(1);

  // 52. SIH DEMO READINESS: Guided narrative wrapper
  return (
    <div className="fixed bottom-4 right-4 max-w-sm z-50">
      <div className="bg-primary text-primary-foreground p-4 rounded-xl shadow-2xl border-2 border-primary/50">
        <div className="flex justify-between items-center mb-2 border-b border-primary-foreground/20 pb-2">
          <h4 className="font-black text-sm">SIH 2026 Jury Mode</h4>
          <span className="text-xs bg-black/20 px-2 py-1 rounded-full">Step {step}/5</span>
        </div>
        
        <div className="text-sm mb-4 min-h-[60px]">
          {step === 1 && "Start at the ASHA Worker app. Create a patient offline and sync."}
          {step === 2 && "View the Doctor Dashboard. Notice the real-time AI triage highlighting the urgent case."}
          {step === 3 && "Complete the consultation and trigger a Counter-Referral."}
          {step === 4 && "Check the Admin Analytics for the predictive supply chain warning."}
          {step === 5 && "Review the Care Gap Engine to see the ASHA worker's pending follow-up."}
        </div>
        
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-foreground"
            disabled={step === 1}
            onClick={() => setStep(s => s - 1)}
          >
            Prev
          </Button>
          <Button 
            size="sm"
            className="bg-white text-primary hover:bg-gray-100"
            disabled={step === 5}
            onClick={() => setStep(s => s + 1)}
          >
            Next Showcase
          </Button>
        </div>
      </div>
    </div>
  );
}

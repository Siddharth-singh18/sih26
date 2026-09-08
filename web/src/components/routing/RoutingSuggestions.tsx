
import { Button } from '../ui/Button';

export default function RoutingSuggestions() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        <span className="text-primary">✨</span> AI Routing Suggestions
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Based on the patient's triage severity (URGENT) and current facility load, the AI suggests the following routing options:
      </p>

      <div className="space-y-3">
        {/* Suggestion 1: Optimal */}
        <div className="border border-primary/40 bg-primary/5 rounded-lg p-4 relative">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
            OPTIMAL
          </div>
          <h4 className="font-semibold text-sm">District Hospital (Cardiology)</h4>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Distance: 12km | Current Load: Low | Doctor Available: Yes</p>
          <Button size="sm" className="w-full">Route to District Hospital</Button>
        </div>

        {/* Suggestion 2: Fallback */}
        <div className="border border-muted bg-muted/20 rounded-lg p-4">
          <h4 className="font-semibold text-sm">CHC - Sub-district Center</h4>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Distance: 4km | Current Load: HIGH (45m wait)</p>
          <Button size="sm" variant="outline" className="w-full">Route to CHC (Waitlist)</Button>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t text-xs text-muted-foreground text-center">
        *Routing recommendations use realtime facility load balancing algorithms.
      </div>
    </div>
  );
}

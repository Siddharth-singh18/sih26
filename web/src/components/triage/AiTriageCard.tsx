

interface TriageProps {
  score: number;
  urgencyLevel: 'ROUTINE' | 'EVALUATE' | 'URGENT' | 'EMERGENCY';
  explanation: string;
  provenanceModel: string;
  confidence: number;
}

export default function AiTriageCard({ score, urgencyLevel, explanation, provenanceModel, confidence }: TriageProps) {
  // 39. AI EXPLAINABILITY & PROVENANCE UI
  const getBadgeColor = (level: string) => {
    switch(level) {
      case 'EMERGENCY': return 'bg-red-100 text-red-800 border-red-200';
      case 'URGENT': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'EVALUATE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ROUTINE': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm relative overflow-hidden">
      {/* Decorative top border based on urgency */}
      <div className={`absolute top-0 left-0 w-full h-1 ${getBadgeColor(urgencyLevel).split(' ')[0]}`}></div>
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2 text-indigo-900">
            Clinical Decision Support
            <span className="text-xs px-2 py-0.5 rounded-full border bg-indigo-50 font-normal text-indigo-700">
              Beta
            </span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            AI Recommendation by {provenanceModel} {provenanceModel.includes('Fallback') && <span className="text-orange-600 font-medium">(Deterministic Fallback)</span>}
          </p>
        </div>
        
        <div className={`px-3 py-1 rounded-md border font-bold text-sm ${getBadgeColor(urgencyLevel)}`}>
          {urgencyLevel} (Score: {score})
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-4 mb-4 border border-border/50">
        <h4 className="text-sm font-semibold mb-2">Clinical Explanation</h4>
        <p className="text-sm text-foreground leading-relaxed">
          {explanation}
        </p>
      </div>

      <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          Confidence: {confidence}%
        </div>
        <div>
          <button className="hover:underline text-primary">Report Inaccuracy</button>
        </div>
      </div>
    </div>
  );
}

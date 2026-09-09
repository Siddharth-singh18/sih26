import { Button } from '../ui/Button';
import { Building2, CheckCircle2, XCircle, MapPin, Clock } from 'lucide-react';

export interface FacilityRouteItem {
  facility_id?: string;
  facilityId?: string;
  facility_name?: string;
  facilityName?: string;
  type?: string;
  facilityType?: string;
  level?: number;
  score?: number;
  eligible?: boolean;
  isEligible?: boolean;
  ineligibilityReasons?: string[];
  reasons?: string[];
  distance_km?: number | null;
  estimated_travel_time_minutes?: number | null;
  distanceStatus?: string;
  active_queue_count?: number;
  capacity?: {
    icu_available?: number;
    oxygen_available?: number;
    total_available?: number;
  };
}

interface RoutingSuggestionsProps {
  suggestions?: FacilityRouteItem[];
  urgency?: string;
  onSelectFacility?: (facilityId: string) => void;
  selectedFacilityId?: string;
}

export default function RoutingSuggestions({
  suggestions = [],
  urgency = 'ROUTINE',
  onSelectFacility,
  selectedFacilityId
}: RoutingSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm text-center">
        <h3 className="font-bold text-base mb-2 flex items-center justify-center gap-2 text-gray-800">
          <Building2 className="text-[#1e6641] w-5 h-5" /> Capability-Aware Facility Routing
        </h3>
        <p className="text-xs text-gray-500">
          No destination facilities evaluated yet. Enter triage assessment to calculate optimal routing.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base flex items-center gap-2 text-gray-900">
          <Building2 className="text-[#1e6641] w-5 h-5" /> Recommended Healthcare Destinations
        </h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
          Urgency: {urgency}
        </span>
      </div>

      <p className="text-xs text-gray-600 mb-4">
        Destination ranking based on live PostgreSQL telemetry: clinical capabilities, specialist presence, ICU/oxygen capacity, and active queue load.
      </p>

      <div className="space-y-3">
        {suggestions.map((fac, idx) => {
          const id = fac.facility_id || fac.facilityId || `fac-${idx}`;
          const name = fac.facility_name || fac.facilityName || 'Healthcare Facility';
          const facType = fac.type || fac.facilityType || 'Hospital';
          const isEligible = fac.eligible ?? fac.isEligible ?? true;
          const isSelected = selectedFacilityId === id;
          const isOptimal = idx === 0 && isEligible;

          return (
            <div
              key={id}
              className={`border rounded-xl p-4 relative transition-all ${
                isSelected
                  ? 'border-[#1e6641] bg-[#e4efe7]/30 ring-2 ring-[#1e6641]/20'
                  : isEligible
                  ? 'border-gray-200 bg-white hover:border-[#1e6641]/50'
                  : 'border-red-200 bg-red-50/20 opacity-85'
              }`}
            >
              {isOptimal && (
                <div className="absolute top-0 right-0 bg-[#1e6641] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-bl-lg rounded-tr-xl">
                  OPTIMAL DESTINATION
                </div>
              )}

              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    {name}
                    {fac.level && (
                      <span className="text-[10px] font-normal text-gray-500">
                        (Level {fac.level} {facType})
                      </span>
                    )}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                    {fac.distance_km != null ? (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {fac.distance_km} km
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <MapPin size={12} /> Distance: Not recorded in schema
                      </span>
                    )}

                    {fac.estimated_travel_time_minutes != null && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> ~{fac.estimated_travel_time_minutes} min travel
                      </span>
                    )}

                    {fac.active_queue_count !== undefined && (
                      <span>• Active Queue: {fac.active_queue_count} waiting</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  {isEligible ? (
                    <span className="inline-block text-xs font-bold text-[#1e6641] bg-[#e4efe7] px-2 py-0.5 rounded-md">
                      {fac.score ?? 0}/100 Match
                    </span>
                  ) : (
                    <span className="inline-block text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                      Ineligible
                    </span>
                  )}
                </div>
              </div>

              {/* Ineligibility Reasons */}
              {!isEligible && fac.ineligibilityReasons && fac.ineligibilityReasons.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-200 text-xs text-red-800">
                  <div className="font-semibold flex items-center gap-1 mb-1">
                    <XCircle size={13} className="text-red-600" /> Ineligible for referral:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {fac.ineligibilityReasons.map((r, ri) => (
                      <li key={ri}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Positive Match Reasons */}
              {isEligible && fac.reasons && fac.reasons.length > 0 && (
                <div className="mt-2 text-[11px] text-[#1e6641] flex flex-wrap items-center gap-1.5">
                  <CheckCircle2 size={12} className="shrink-0" />
                  <span>{fac.reasons.slice(0, 3).join(' • ')}</span>
                </div>
              )}

              {onSelectFacility && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Button
                    size="sm"
                    variant={isSelected ? 'default' : isEligible ? 'outline' : 'outline'}
                    disabled={!isEligible}
                    className={`w-full text-xs font-medium ${
                      isSelected
                        ? 'bg-[#1e6641] text-white'
                        : isEligible
                        ? 'border-[#1e6641] text-[#1e6641] hover:bg-[#e4efe7]'
                        : 'border-gray-200 text-gray-400'
                    }`}
                    onClick={() => onSelectFacility(id)}
                  >
                    {isSelected ? '✓ Destination Selected' : isEligible ? `Route to ${name}` : 'Facility Ineligible'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 text-center">
        *Routing scores are deterministically computed from live hospital capacities, services, and queues.
      </div>
    </div>
  );
}

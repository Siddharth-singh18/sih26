import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  Compass,
  Clock,
  CheckCircle,
  X
} from 'lucide-react';
import api from '../../lib/api';

interface FacilityNearbyResult {
  facilityId: string;
  facilityName: string;
  facilityType: string;
  level: number;
  distanceKm: number | null;
  travelTimeLabel: string;
  readinessScore: number;
  queueLoad: number;
  bedCapacities: {
    icu_beds?: { available: number; total: number };
    oxygen_beds?: { available: number; total: number };
    general_beds?: { available: number; total: number };
    maternity_beds?: { available: number; total: number };
  };
  whySelected: string;
  lastUpdated: string;
}

interface FindNearbyCareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FindNearbyCareModal: React.FC<FindNearbyCareModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [bedFilter, setBedFilter] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ROUTINE');
  const [loading, setLoading] = useState(false);
  const [facilities, setFacilities] = useState<FacilityNearbyResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchNearbyCare = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        latitude: 18.1507, // Baramati CHC reference coordinates
        longitude: 74.5768,
        urgency: urgencyFilter,
        limit: 5
      };

      if (bedFilter !== 'ALL') {
        payload.requiredBedType = bedFilter;
      }

      const res = await api.post('/routing/nearby', payload);
      setFacilities(res.data.facilities || []);
    } catch {
      setError(t('routing.error', 'Unable to fetch real-time facility routes. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNearbyCare();
    }
  }, [isOpen, bedFilter, urgencyFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-emerald-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-emerald-800 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Compass className="h-5 w-5 text-emerald-100" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{t('action.find_nearby_care', 'Find Nearby Care')}</h2>
              <p className="text-xs text-emerald-200">Real Haversine Distance & Active Queue Intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-emerald-200 hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-slate-50 p-3 text-xs">
          <span className="font-medium text-gray-500">Resource:</span>
          {['ALL', 'ICU', 'OXYGEN', 'MATERNITY'].map(type => (
            <button
              key={type}
              onClick={() => setBedFilter(type)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors border ${
                bedFilter === type
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {type === 'ALL' ? 'All Beds' : `${type} Beds`}
            </button>
          ))}

          <span className="ml-auto font-medium text-gray-500">Urgency:</span>
          {['ROUTINE', 'EMERGENCY'].map(u => (
            <button
              key={u}
              onClick={() => setUrgencyFilter(u)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors border ${
                urgencyFilter === u
                  ? u === 'EMERGENCY'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        {/* Facility List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {loading && (
            <div className="py-8 text-center text-sm text-gray-500">
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              Calculating optimal facility routes...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {!loading && facilities.length === 0 && !error && (
            <div className="py-8 text-center text-sm text-gray-500">
              No matching healthcare facilities currently available in this radius.
            </div>
          )}

          {!loading &&
            facilities.map(fac => (
              <div
                key={fac.facilityId}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition-all hover:border-emerald-300"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{fac.facilityName}</h3>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-200">
                        {fac.facilityType} (Level {fac.level})
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{fac.whySelected}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-700">
                      {fac.distanceKm !== null ? `${fac.distanceKm} km` : 'Calculated'}
                    </div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      <span>{fac.travelTimeLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[11px] text-gray-400">Readiness</div>
                    <div className="font-bold text-gray-800">{fac.readinessScore}/100</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[11px] text-gray-400">Queue Load</div>
                    <div className="font-bold text-gray-800">{fac.queueLoad} waiting</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[11px] text-gray-400">Available Beds</div>
                    <div className="font-bold text-emerald-700">
                      {fac.bedCapacities?.icu_beds
                        ? `${fac.bedCapacities.icu_beds.available} ICU / ${fac.bedCapacities.general_beds?.available || 0} Gen`
                        : 'Available'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-white p-3 flex justify-between items-center text-xs text-gray-500">
          <span>Coordinates sourced from Maharashtra State Health System Registry.</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

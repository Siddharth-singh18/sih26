import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function PredictiveOps() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/analytics/dashboard')
      .then(res => setData(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Loading analytics...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Facility Analytics & Predictive Operations</h2>
      
      {/* ACTUAL METRICS */}
      <section className="bg-white border rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">ACTUAL: Current Operational Load</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Total Patients</p>
            <p className="text-2xl font-bold">{data?.actual?.totalPatients || 0}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Active Assessments</p>
            <p className="text-2xl font-bold">{data?.actual?.activeAssessments || 0}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Pending Referrals</p>
            <p className="text-2xl font-bold">{data?.actual?.pendingReferrals || 0}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Patients in Queue</p>
            <p className="text-2xl font-bold">{data?.actual?.patientsInQueue || 0}</p>
          </div>
        </div>
      </section>

      {/* PREDICTED METRICS */}
      <section className="bg-orange-50 border border-orange-200 rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-start border-b border-orange-200 pb-2 mb-4">
            <h3 className="font-bold text-lg text-orange-900">PREDICTED: Forecasts & Risks</h3>
            <div className="text-right text-xs text-orange-700">
                <p>Model: {data?.predicted?.metadata?.model || 'Unknown'}</p>
                <p>Generated At: {data?.predicted?.metadata?.generated_at ? new Date(data.predicted.metadata.generated_at).toLocaleString() : 'Unknown'}</p>
            </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
            <div>
                <h4 className="font-semibold text-orange-800 mb-2">Medicine Stockout Risk</h4>
                <ul className="space-y-3">
                    {data?.predicted?.medicine_stockout_risk?.map((risk: any, i: number) => (
                        <li key={i} className="bg-white/80 p-3 rounded shadow-sm border border-orange-100 flex justify-between items-center">
                            <div>
                                <span className="font-medium text-gray-800">{risk.medicine}</span>
                                <p className="text-xs text-gray-500">Est. Depletion: {risk.timeframe_days} days</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-xs px-2 py-1 rounded font-bold ${risk.risk === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {risk.risk} RISK
                                </span>
                                <p className="text-xs text-gray-400 mt-1">Conf: {risk.confidence * 100}%</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <div>
                <h4 className="font-semibold text-orange-800 mb-2">Diagnostic Demand Forecast</h4>
                <ul className="space-y-3">
                    {data?.predicted?.diagnostic_demand_forecast?.map((demand: any, i: number) => (
                        <li key={i} className="bg-white/80 p-3 rounded shadow-sm border border-orange-100 flex justify-between items-center">
                            <span className="font-medium text-gray-800">{demand.test}</span>
                            <div className="text-right">
                                <span className="text-sm font-bold text-orange-700">+{demand.expected_increase_pct}% Demand</span>
                                <p className="text-xs text-gray-400 mt-1">Conf: {demand.confidence * 100}%</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
      </section>
    </div>
  );
}

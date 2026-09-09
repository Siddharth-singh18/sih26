import { useLanguage } from '../../context/LanguageContext';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const URGENCY_MAP: Record<string, { label: string; className: string }> = {
  URGENT:   { label: 'Needs urgent care',       className: 'bg-red-100 text-red-700 border border-red-200' },
  PRIORITY: { label: 'Should see doctor soon',  className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  ROUTINE:  { label: 'Can be monitored',        className: 'bg-green-100 text-green-700 border border-green-200' },
};
interface StatusConfig {
  key: string;
  defaultLabel: string;
  className: string;
}

const REFERRAL_MAP: Record<string, { label: string; className: string }> = {
  CREATED:              { label: 'Draft',                     className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  SUBMITTED:            { label: 'Sent to clinic',            className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  ACCEPTED:             { label: 'Clinic accepted',           className: 'bg-green-100 text-green-700 border border-green-200' },
  REJECTED:             { label: 'Declined',                  className: 'bg-red-100 text-red-700 border border-red-200' },
  SCHEDULED:            { label: 'Appointment set',           className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  PATIENT_ARRIVED:      { label: 'Patient arrived',           className: 'bg-green-100 text-green-700 border border-green-200' },
  IN_CONSULTATION:      { label: 'In consultation',           className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  DIAGNOSTICS_PENDING:  { label: 'Tests in progress',         className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  TREATMENT:            { label: 'Under treatment',           className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  COUNTER_REFERRED:     { label: 'Doctor sent instructions',  className: 'bg-[#e4efe7] text-[#1e6641] border border-[#1e6641]/20' },
  FOLLOW_UP_REQUIRED:   { label: 'Follow-up needed',          className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  COMPLETED:            { label: 'Case closed',               className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  CANCELLED:            { label: 'Cancelled',                 className: 'bg-gray-100 text-gray-500 border border-gray-200' },
};
const STATUS_MAP: Record<string, StatusConfig> = {
  // Urgency
  URGENT:              { key: 'status.urgent', defaultLabel: 'Needs urgent care', className: 'bg-red-100 text-red-700 border border-red-200' },
  PRIORITY:            { key: 'status.priority', defaultLabel: 'Should see doctor soon', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  ROUTINE:             { key: 'status.routine', defaultLabel: 'Can be monitored', className: 'bg-green-100 text-green-700 border border-green-200' },
  EMERGENCY:           { key: 'status.emergency', defaultLabel: 'EMERGENCY', className: 'bg-red-100 text-red-700 border border-red-200' },

const QUEUE_MAP: Record<string, { label: string; className: string }> = {
  WAITING:        { label: 'Waiting',      className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  IN_CONSULTATION:{ label: 'With doctor',  className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  COMPLETED:      { label: 'Done',         className: 'bg-gray-100 text-gray-500 border border-gray-200' },
  PRIORITY:       { label: 'Urgent',       className: 'bg-red-100 text-red-700 border border-red-200' },
  // Queue
  WAITING:             { key: 'status.waiting', defaultLabel: 'Waiting', className: 'bg-amber-100 text-amber-700 border border-amber-200' },

  // Referrals & Workflow
  CREATED:             { key: 'status.draft', defaultLabel: 'Draft', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  DRAFT:               { key: 'status.draft', defaultLabel: 'Draft', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  SUBMITTED:           { key: 'status.submitted', defaultLabel: 'Sent to clinic', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  ACCEPTED:            { key: 'status.accepted', defaultLabel: 'Clinic accepted', className: 'bg-green-100 text-green-700 border border-green-200' },
  REJECTED:            { key: 'status.rejected', defaultLabel: 'Declined', className: 'bg-red-100 text-red-700 border border-red-200' },
  SCHEDULED:           { key: 'status.scheduled', defaultLabel: 'Appointment set', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  PATIENT_ARRIVED:     { key: 'status.patient_arrived', defaultLabel: 'Patient arrived', className: 'bg-green-100 text-green-700 border border-green-200' },
  ARRIVED:             { key: 'status.arrived', defaultLabel: 'Arrived', className: 'bg-green-100 text-green-700 border border-green-200' },
  IN_CONSULTATION:     { key: 'status.in_consultation', defaultLabel: 'In consultation', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  IN_PROGRESS:         { key: 'status.in_progress', defaultLabel: 'In progress', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  DIAGNOSTICS_PENDING: { key: 'status.diagnostics_pending', defaultLabel: 'Tests in progress', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  TREATMENT:           { key: 'status.treatment', defaultLabel: 'Under treatment', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  COUNTER_REFERRED:    { key: 'status.counter_referred', defaultLabel: 'Doctor sent instructions', className: 'bg-[#e4efe7] text-[#1e6641] border border-[#1e6641]/20' },
  FOLLOW_UP_REQUIRED:  { key: 'status.follow_up_required', defaultLabel: 'Follow-up needed', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  COMPLETED:           { key: 'status.completed', defaultLabel: 'Case closed', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  CANCELLED:           { key: 'status.cancelled', defaultLabel: 'Cancelled', className: 'bg-gray-100 text-gray-500 border border-gray-200' },
  BOOKED:              { key: 'status.booked', defaultLabel: 'Booked', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  CONFIRMED:           { key: 'status.confirmed', defaultLabel: 'Confirmed', className: 'bg-green-100 text-green-700 border border-green-200' },
  WAITING:             { key: 'status.waiting', defaultLabel: 'Waiting', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  OVERDUE:             { key: 'status.overdue', defaultLabel: 'Overdue', className: 'bg-red-100 text-red-700 border border-red-200' },
  PENDING:             { key: 'status.pending', defaultLabel: 'Pending', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  ACTIVE:              { key: 'status.active', defaultLabel: 'Active', className: 'bg-green-100 text-green-700 border border-green-200' },
  RESOLVED:            { key: 'status.resolved', defaultLabel: 'Resolved', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  NORMAL:              { key: 'status.normal', defaultLabel: 'Normal', className: 'bg-[#e4efe7] text-[#1e6641] border border-[#1e6641]/20' },
  ABNORMAL:            { key: 'status.abnormal', defaultLabel: 'Abnormal Range', className: 'bg-red-100 text-red-700 border border-red-200' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const map = { ...URGENCY_MAP, ...REFERRAL_MAP, ...QUEUE_MAP };
  const config = map[status] ?? { label: status.replace(/_/g, ' '), className: 'bg-gray-100 text-gray-600 border border-gray-200' };
  const { t } = useLanguage();
  const raw = (status || '').toUpperCase().trim();
  const config = STATUS_MAP[raw] || {
    key: `status.${raw.toLowerCase()}`,
    defaultLabel: status ? status.replace(/_/g, ' ') : '',
    className: 'bg-gray-100 text-gray-600 border border-gray-200'
  };

  const label = t(config.key, config.defaultLabel);
  const sizeClass = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizeClass} ${config.className}`}>
      {config.label}
      {label}
    </span>
  );
}

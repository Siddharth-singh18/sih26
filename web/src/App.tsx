import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import SplashScreen from './components/ui/SplashScreen';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkerDashboard from './pages/WorkerDashboard';
import PatientIntakeFlow from './pages/PatientIntakeFlow';
import ReferralSuccess from './pages/ReferralSuccess';
import CareGaps from './pages/CareGaps';
import Patients from './pages/Patients';
import PatientProfile from './pages/PatientProfile';
import FacilityReadiness from './pages/FacilityReadiness';
import Queue from './pages/Queue';
import PatientDashboard from './pages/PatientDashboard';
import PredictiveOps from './pages/PredictiveOps';
import { clearOfflineDataOnLogout } from './lib/db';
import {
  HeartPulse,
  LogOut,
  LayoutDashboard,
  Users,
  Clock,
  Building2,
  UserPlus,
  RefreshCw,
  AlertTriangle,
  Activity,
  Mic,
  BookOpen,
  Compass,
  MessageSquare,
} from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { VoiceInputModal } from './components/ui/VoiceInputModal';
import { PatientHealthAssistant } from './components/assistant/PatientHealthAssistant';
import { FindNearbyCareModal } from './components/routing/FindNearbyCareModal';
import LanguageSelector from './components/ui/LanguageSelector';

// ─── Shared nav link component ───────────────────────────────────────────────
function NavLink({ to, exact, children }: { to: string; exact?: boolean; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isActive = exact ? pathname === to : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-[#e4efe7] text-[#1e6641]'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {children}
    </Link>
  );
}

// ─── Protected shell ─────────────────────────────────────────────────────────
const ProtectedRoute = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('ayusync_token');
  const user   = JSON.parse(localStorage.getItem('ayusync_user') || '{}');
  const [currentRole, setCurrentRole] = useState<string>(user.role || 'DOCTOR');
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isNearbyCareOpen, setIsNearbyCareOpen] = useState(false);
  const { language, simpleMode, toggleSimpleMode, t } = useLanguage();

  if (!token) return <Navigate to="/login" replace />;

  const isWorker = currentRole === 'WORKER';
  const isPatient = currentRole === 'PATIENT';

  const switchRole = () => {
    let newRole = 'DOCTOR';
    let newName = 'Dr. Rajesh Deshmukh';
    if (currentRole === 'DOCTOR') {
      newRole = 'WORKER';
      newName = 'Sunita Patil';
    } else if (currentRole === 'WORKER') {
      newRole = 'PATIENT';
      newName = 'Ramesh Kulkarni';
    } else {
      newRole = 'DOCTOR';
      newName = 'Dr. Rajesh Deshmukh';
    }

    const updated = { ...user, role: newRole, name: newName };
    localStorage.setItem('ayusync_user', JSON.stringify(updated));
    setCurrentRole(newRole);
    if (newRole === 'WORKER') navigate('/worker');
    else if (newRole === 'PATIENT') navigate('/patient');
    else navigate('/dashboard');
  };

  const displayName = user.name || (isWorker ? 'Sunita Patil' : isPatient ? 'Ramesh Kulkarni' : 'Dr. Rajesh Deshmukh');

  return (
    <div className="min-h-screen bg-[#f8f7f3] font-sans text-gray-900">
      {/* ── Top navigation bar ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6 gap-4">

          {/* Brand */}
          <Link to={isWorker ? '/worker' : isPatient ? '/patient' : '/dashboard'} className="flex items-center gap-2 shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-[#1e6641] text-white flex items-center justify-center group-hover:opacity-90 transition-opacity">
              <HeartPulse size={18} strokeWidth={2} />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-gray-900 leading-tight">{t('app.name', 'SwasthyaSetu')}</div>
              <div className="text-[10px] text-gray-400 leading-tight">{t('app.subtitle', 'AyuSync · Baramati CHC')}</div>
            </div>
          </Link>

          {/* Role-aware navigation */}
          <nav className="hidden md:flex items-center gap-1 flex-1 ml-6">
            {isWorker ? (
              <>
                <NavLink to="/worker" exact><LayoutDashboard size={15} />{t('nav.tasks', 'Home & Tasks')}</NavLink>
                <NavLink to="/patients"><Users size={15} />{t('nav.community', 'Community Members')}</NavLink>
                <NavLink to="/followups"><AlertTriangle size={15} />{t('nav.continuity', 'Care Gap Alerts')}</NavLink>
              </>
            ) : isPatient ? (
              <>
                <NavLink to="/patient" exact><LayoutDashboard size={15} />{t('nav.home', 'My Care Dashboard')}</NavLink>
                <NavLink to={user.patientId ? `/patients/${user.patientId}` : '/patients'} exact><Users size={15} />{t('nav.patients', 'My Health Record')}</NavLink>
                <NavLink to="/facilities"><Building2 size={15} />{t('nav.clinic_status', 'Clinic Status')}</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/dashboard" exact><LayoutDashboard size={15} />{t('nav.home', 'Home')}</NavLink>
                <NavLink to="/queue"><Clock size={15} />{t('nav.queue', 'Consultation Queue')}</NavLink>
                <NavLink to="/followups"><AlertTriangle size={15} />{t('nav.continuity', 'Care Continuity')}</NavLink>
                <NavLink to="/patients"><Users size={15} />{t('nav.patients', 'Patient Records')}</NavLink>
                <NavLink to="/facilities"><Building2 size={15} />{t('nav.clinic_status', 'Clinic Status')}</NavLink>
                <NavLink to="/operations"><Activity size={15} />{t('nav.operations', 'Operations')}</NavLink>
              </>
            )}
          </nav>

          {/* Right side controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Health-Literacy Mode Toggle */}
            <button
              onClick={toggleSimpleMode}
              title={simpleMode ? 'Health-Literacy Mode ON (Simple plain explanations enabled)' : 'Toggle Health-Literacy Mode for simpler medical terms'}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                simpleMode
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BookOpen size={12} className={simpleMode ? 'text-emerald-700' : 'text-gray-400'} />
              <span className="hidden xl:inline">
                {simpleMode ? (language === 'hi' ? 'सरल भाषा सक्रिय' : 'Simple Mode ON') : (language === 'hi' ? 'सरल भाषा' : 'Simple Mode')}
              </span>
            </button>

            {/* Polished 23 Indian Languages Selector */}
            <LanguageSelector />

            {/* Find Nearby Care Button */}
            <button
              type="button"
              onClick={() => setIsNearbyCareOpen(true)}
              title={t('action.find_nearby_care', 'Find Nearby Care')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-medium text-emerald-800 shadow-xs transition-colors"
            >
              <Compass size={13} className="text-emerald-700" />
              <span className="hidden lg:inline">{t('action.find_nearby_care', 'Find Care')}</span>
            </button>

            {/* AyuSync Health Assistant Trigger */}
            <button
              type="button"
              onClick={() => setIsAssistantOpen(true)}
              title={t('nav.assistant', 'AyuSync Health Assistant')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-xs font-medium text-indigo-800 shadow-xs transition-colors"
            >
              <MessageSquare size={13} className="text-indigo-700" />
              <span className="hidden lg:inline">{t('nav.assistant', 'Assistant')}</span>
            </button>

            {/* Voice Assistant Gate */}
            <button
              type="button"
              onClick={() => setIsVoiceOpen(true)}
              title={t('voice.title', 'Voice Assistant')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 shadow-xs transition-colors"
            >
              <Mic size={13} className="text-[#1e6641]" />
              <span className="hidden sm:inline">{language === 'hi-IN' || language === 'hi' ? 'ध्वनि' : 'Voice'}</span>
              <span className="hidden sm:inline">{t('voice.title', 'Voice')}</span>
            </button>

            {/* Prominent Demo Role Switcher */}
            <button
              onClick={switchRole}
              title="Click to switch between Doctor and Village Health Worker roles"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs text-gray-700 shadow-sm transition-all hover:border-[#1e6641]/50"
            >
              <span className="hidden sm:inline text-gray-500">Role:</span>
              <span className="hidden sm:inline text-gray-500">{t('role.label', 'Role')}:</span>
              <span className="font-semibold text-[#1e6641] flex items-center gap-1">
                {isWorker ? '👩‍⚕️ ASHA' : isPatient ? '🧑 Patient' : '👨‍⚕️ MO'}
              </span>
              <RefreshCw size={11} className="text-gray-400 ml-0.5" />
            </button>

            {/* + New Patient (worker only, persistent CTA) */}
            {isWorker && (
              <Link
                to="/intake"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e6641] hover:bg-[#165032] text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <UserPlus size={13} />
                New Patient
                {t('action.new_patient', 'New Patient')}
              </Link>
            )}

            {/* Avatar + name */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200">
              <div className="w-7 h-7 rounded-full bg-[#e4efe7] text-[#1e6641] flex items-center justify-center font-bold text-xs">
                {displayName.charAt(0)}
              </div>
              <div className="text-xs font-semibold text-gray-800 leading-tight">
                {displayName}
              </div>
            </div>

            <button
              onClick={async () => {
                await clearOfflineDataOnLogout();
                localStorage.removeItem('ayusync_token');
                localStorage.removeItem('ayusync_user');
                window.location.href = '/login';
              }}
              title="Sign out"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>



      {/* ── Page content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* ── Mobile bottom navigation bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-center justify-around py-2 px-2 shadow-lg">
        {isWorker ? (
          <>
            <Link to="/worker" className="flex flex-col items-center text-[10px] font-medium text-gray-600 hover:text-[#1e6641]">
              <LayoutDashboard size={18} />
              <span>Tasks</span>
            </Link>
            <Link to="/intake" className="flex flex-col items-center text-[10px] font-medium text-[#1e6641]">
              <div className="w-8 h-8 rounded-full bg-[#1e6641] text-white flex items-center justify-center -mt-3 shadow-md">
                <UserPlus size={16} />
              </div>
              <span>Intake</span>
            </Link>
            <Link to="/followups" className="flex flex-col items-center text-[10px] font-medium text-gray-600 hover:text-[#1e6641]">
              <AlertTriangle size={18} />
              <span>Alerts</span>
            </Link>
            <Link to="/patients" className="flex flex-col items-center text-[10px] font-medium text-gray-600 hover:text-[#1e6641]">
              <Users size={18} />
              <span>Patients</span>
            </Link>
          </>
        ) : isPatient ? (
          <>
            <Link to="/patient" className="flex flex-col items-center text-[10px] font-medium text-[#1e6641]">
              <LayoutDashboard size={18} />
              <span>My Care</span>
            </Link>
            <Link to={user.patientId ? `/patients/${user.patientId}` : '/patients'} className="flex flex-col items-center text-[10px] font-medium text-gray-600 hover:text-[#1e6641]">
              <Users size={18} />
              <span>Health Record</span>
            </Link>
            <Link to="/facilities" className="flex flex-col items-center text-[10px] font-medium text-gray-600 hover:text-[#1e6641]">
              <Building2 size={18} />
              <span>Clinic Status</span>
            </Link>
          </>
        ) : (
          <>
            <Link to="/dashboard" className="flex flex-col items-center text-[10px] font-medium text-gray-600 hover:text-[#1e6641]">
              <LayoutDashboard size={18} />
              <span>Home</span>
            </Link>
            <Link to="/queue" className="flex flex-col items-center text-[10px] font-medium text-[#1e6641]">
              <Clock size={18} />
              <span>Queue</span>
            </Link>
            <Link to="/followups" className="flex flex-col items-center text-[10px] font-medium text-gray-600 hover:text-[#1e6641]">
              <AlertTriangle size={18} />
              <span>Continuity</span>
            </Link>
            <Link to="/patients" className="flex flex-col items-center text-[10px] font-medium text-gray-600 hover:text-[#1e6641]">
              <Users size={18} />
              <span>Patients</span>
            </Link>
          </>
        )}
      </nav>

      {/* Voice Assistant Safety Review Modal */}
      <VoiceInputModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onConfirm={(confirmedText) => {
          console.log('[VoiceAssistant] Verified speech transcript:', confirmedText);
        }}
      />

      {/* Patient Health Assistant Modal */}
      <PatientHealthAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        patientId={user.patientId}
      />

      {/* Find Nearby Care Modal */}
      <FindNearbyCareModal
        isOpen={isNearbyCareOpen}
        onClose={() => setIsNearbyCareOpen(false)}
      />
    </div>

  );
};

// ─── Root app ─────────────────────────────────────────────────────────────────
export default function App() {
  const [splashDone, setSplashDone] = useState(
    () => sessionStorage.getItem('spl_shown') === '1'
  );

  return (
    <LanguageProvider>
      {!splashDone && (
        <SplashScreen onFinish={() => {
          sessionStorage.setItem('spl_shown', '1');
          setSplashDone(true);
        }} />
      )}
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"         element={<Dashboard />} />
            <Route path="/worker"            element={<WorkerDashboard />} />
            <Route path="/intake"            element={<PatientIntakeFlow />} />
            <Route path="/referral-success"  element={<ReferralSuccess />} />
            <Route path="/followups"         element={<CareGaps />} />
            <Route path="/patients"          element={<Patients />} />
            <Route path="/patients/:id"      element={<PatientProfile />} />
            <Route path="/queue"             element={<Queue />} />
            <Route path="/facilities"        element={<FacilityReadiness />} />
            <Route path="/operations"        element={<PredictiveOps />} />
            <Route path="/analytics"         element={<PredictiveOps />} />
            <Route path="/patient"           element={<PatientDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

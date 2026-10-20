import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SiteProvider } from './auth/SiteContext';
import { ToastProvider } from './components/Toasts';

const Login = lazy(() => import('./pages/Login'));
const SiteControl = lazy(() => import('./pages/SiteControl'));
const Home = lazy(() => import('./pages/Home'));
const Monitoring = lazy(() => import('./pages/Monitoring'));
const Alarms = lazy(() => import('./pages/Alarms'));
const Analysis = lazy(() => import('./pages/Analysis'));
const Kpi = lazy(() => import('./pages/Kpi'));
const Settings = lazy(() => import('./pages/Settings'));
const WebAdmin = lazy(() => import('./pages/WebAdmin'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === 'checking') return null;
  if (status === 'out') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

function Root() {
  const { status, user } = useAuth();
  if (status === 'checking') return null;
  return <Navigate to={status !== 'in' ? '/login' : user?.level === 'super' ? '/admin' : '/home'} replace />;
}

const guard = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;

export function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <ToastProvider>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Root />} />
              <Route path="/login" element={<Login />} />
              <Route path="/sites" element={guard(<SiteControl />)} />
              <Route path="/home" element={guard(<Home />)} />
              <Route path="/monitoring" element={guard(<Monitoring />)} />
              <Route path="/alarms" element={guard(<Alarms />)} />
              <Route path="/analysis" element={guard(<Analysis />)} />
              <Route path="/kpi" element={guard(<Kpi />)} />
              <Route path="/settings" element={guard(<Settings />)} />
              <Route path="/admin" element={guard(<WebAdmin />)} />
              <Route path="*" element={<Root />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </SiteProvider>
    </AuthProvider>
  );
}

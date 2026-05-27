import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RootProvider from './components/providers/root';
import { AuthProvider } from './contexts/auth-context';
import { ProtectedRoute } from './components/protected-route';
import MeetingCopilotApp from './features/meeting-copilot/meeting-copilot-app';
import LoginScreen from './features/auth/login-screen';
import AuthCallbackScreen from './features/auth/auth-callback-screen';
import AuthErrorScreen from './features/auth/auth-error-screen';

function App() {
  return (
    <RootProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path='/login' element={<LoginScreen />} />
            <Route path='/auth/callback' element={<AuthCallbackScreen />} />
            <Route path='/auth/error' element={<AuthErrorScreen />} />

            {/* Protected Routes */}
            <Route
              path='/dashboard'
              element={
                <ProtectedRoute>
                  <MeetingCopilotApp />
                </ProtectedRoute>
              }
            />

            {/* Redirect root to dashboard (will be redirected to login if not authenticated) */}
            <Route path='/' element={<Navigate to='/dashboard' replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </RootProvider>
  );
}

export default App;

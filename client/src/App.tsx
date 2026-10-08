import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './store/ThemeContext';
import { AuthProvider } from './store/AuthContext';
import { ToastProvider } from './components/ui/Toast/ToastContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { RoleRoute } from './components/guards/RoleRoute';
import { ShowcasePage } from './pages/ShowcasePage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyDetailPage } from './pages/CompanyDetailPage';
import { JobsPage } from './pages/JobsPage';
import { JobDetailPage } from './pages/JobDetailPage';
import {
  CareerHubPage,
  WorkplacePage,
  FounderHqPage,
  AdminConsolePage,
  UnauthorizedPage,
  NotFoundPage,
} from './pages/StubPages';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ProfileSetupPage } from './pages/ProfileSetupPage';
import { AiManagerPage } from './pages/AiManagerPage';
import { AdminAiHealthPage } from './pages/AdminAiHealthPage';

export function App(): ReactElement {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                {/* Main App Layout */}
                <Route element={<AppShell />}>
                  {/* Public Component Showcase */}
                  <Route path="/" element={<ShowcasePage />} />
                  <Route path="/showcase" element={<ShowcasePage />} />
                  <Route path="/leaderboards" element={<ShowcasePage />} />

                  {/* Company & Job Browsing Routes */}
                  <Route path="/companies" element={<CompaniesPage />} />
                  <Route path="/companies/:id" element={<CompanyDetailPage />} />
                  <Route path="/jobs" element={<JobsPage />} />
                  <Route path="/jobs/:id" element={<JobDetailPage />} />

                  {/* Job Seeker Guarded Routes */}
                  <Route
                    path="/career"
                    element={
                      <RoleRoute allowedCareerRoles={['JOB_SEEKER']}>
                        <CareerHubPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/applications"
                    element={
                      <RoleRoute allowedCareerRoles={['JOB_SEEKER']}>
                        <CareerHubPage />
                      </RoleRoute>
                    }
                  />

                  {/* Employee Guarded Routes */}
                  <Route
                    path="/workplace"
                    element={
                      <RoleRoute allowedCareerRoles={['EMPLOYEE']}>
                        <WorkplacePage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/tasks"
                    element={
                      <RoleRoute allowedCareerRoles={['EMPLOYEE']}>
                        <WorkplacePage />
                      </RoleRoute>
                    }
                  />

                  {/* Founder Guarded Routes */}
                  <Route
                    path="/founder"
                    element={
                      <RoleRoute allowedCareerRoles={['FOUNDER']}>
                        <FounderHqPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/bots"
                    element={
                      <RoleRoute allowedCareerRoles={['FOUNDER']}>
                        <FounderHqPage />
                      </RoleRoute>
                    }
                  />

                  {/* Admin Guarded Routes */}
                  <Route
                    path="/admin"
                    element={
                      <RoleRoute allowedPlatformRoles={['ADMIN']}>
                        <AdminConsolePage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/admin/audit"
                    element={
                      <RoleRoute allowedPlatformRoles={['ADMIN']}>
                        <AdminConsolePage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/admin/ai-health"
                    element={
                      <RoleRoute allowedPlatformRoles={['ADMIN']}>
                        <AdminAiHealthPage />
                      </RoleRoute>
                    }
                  />

                  {/* AI Manager Guarded Routes */}
                  <Route
                    path="/ai-ops"
                    element={
                      <RoleRoute allowedPlatformRoles={['AI_MANAGER']}>
                        <AiManagerPage />
                      </RoleRoute>
                    }
                  />

                  {/* Auth & Error Pages */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/profile/setup" element={<ProfileSetupPage />} />
                  <Route path="/unauthorized" element={<UnauthorizedPage />} />
                  <Route path="/404" element={<NotFoundPage />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

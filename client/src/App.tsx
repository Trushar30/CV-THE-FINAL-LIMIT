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
  FounderHqPage,
  AdminConsolePage,
  UnauthorizedPage,
  NotFoundPage,
} from './pages/StubPages';
import { WorkplaceDashboardPage } from './pages/employee/WorkplaceDashboardPage';
import { TaskWorkPage } from './pages/employee/TaskWorkPage';
import { TaskHistoryPage } from './pages/employee/TaskHistoryPage';
import { ApplicationsTrackerPage } from './pages/career/ApplicationsTrackerPage';
import { StageChatPage } from './pages/career/StageChatPage';
import { OfferPage } from './pages/career/OfferPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ProfileSetupPage } from './pages/ProfileSetupPage';
import { AiManagerPage } from './pages/AiManagerPage';
import { AdminAiHealthPage } from './pages/AdminAiHealthPage';
import { AdminDemoPage } from './pages/admin/AdminDemoPage';

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
                      <RoleRoute allowedCareerRoles={['JOB_SEEKER', 'EMPLOYEE']}>
                        <ApplicationsTrackerPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/applications"
                    element={
                      <RoleRoute allowedCareerRoles={['JOB_SEEKER', 'EMPLOYEE']}>
                        <ApplicationsTrackerPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/applications/:id"
                    element={
                      <RoleRoute allowedCareerRoles={['JOB_SEEKER', 'EMPLOYEE']}>
                        <StageChatPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/applications/:id/stage"
                    element={
                      <RoleRoute allowedCareerRoles={['JOB_SEEKER', 'EMPLOYEE']}>
                        <StageChatPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/applications/:id/offer"
                    element={
                      <RoleRoute allowedCareerRoles={['JOB_SEEKER', 'EMPLOYEE']}>
                        <OfferPage />
                      </RoleRoute>
                    }
                  />

                  {/* Employee Guarded Routes */}
                  <Route
                    path="/workplace"
                    element={
                      <RoleRoute allowedCareerRoles={['EMPLOYEE']}>
                        <WorkplaceDashboardPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/employee/dashboard"
                    element={
                      <RoleRoute allowedCareerRoles={['EMPLOYEE']}>
                        <WorkplaceDashboardPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/tasks"
                    element={
                      <RoleRoute allowedCareerRoles={['EMPLOYEE']}>
                        <WorkplaceDashboardPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/tasks/history"
                    element={
                      <RoleRoute allowedCareerRoles={['EMPLOYEE']}>
                        <TaskHistoryPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/tasks/:id"
                    element={
                      <RoleRoute allowedCareerRoles={['EMPLOYEE']}>
                        <TaskWorkPage />
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
                  <Route
                    path="/admin/demo"
                    element={
                      <RoleRoute allowedPlatformRoles={['ADMIN']}>
                        <AdminDemoPage />
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

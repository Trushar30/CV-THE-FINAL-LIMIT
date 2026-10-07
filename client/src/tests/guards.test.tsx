import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, DEFAULT_MOCK_USER } from '../store/AuthContext';
import { ProtectedRoute } from '../components/guards/ProtectedRoute';
import { RoleRoute } from '../components/guards/RoleRoute';

describe('Route Guards Suite', () => {
  it('allows access to protected route when authenticated', () => {
    render(
      <AuthProvider initialUser={DEFAULT_MOCK_USER}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Secret Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Protected Secret Content')).toBeDefined();
  });

  it('redirects to login when unauthenticated', () => {
    render(
      <AuthProvider initialUser={null}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Secret Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Redirected Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Redirected Login Page')).toBeDefined();
    expect(screen.queryByText('Protected Secret Content')).toBeNull();
  });

  it('permits employee role to access employee route', () => {
    const employeeUser = {
      ...DEFAULT_MOCK_USER,
      careerRole: 'EMPLOYEE' as const,
    };

    render(
      <AuthProvider initialUser={employeeUser}>
        <MemoryRouter initialEntries={['/workplace']}>
          <Routes>
            <Route
              path="/workplace"
              element={
                <RoleRoute allowedCareerRoles={['EMPLOYEE']}>
                  <div>Employee Workplace View</div>
                </RoleRoute>
              }
            />
            <Route path="/unauthorized" element={<div>Access Denied</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Employee Workplace View')).toBeDefined();
  });

  it('redirects job seeker attempting to access founder route to unauthorized', () => {
    const jobSeekerUser = {
      ...DEFAULT_MOCK_USER,
      careerRole: 'JOB_SEEKER' as const,
    };

    render(
      <AuthProvider initialUser={jobSeekerUser}>
        <MemoryRouter initialEntries={['/founder']}>
          <Routes>
            <Route
              path="/founder"
              element={
                <RoleRoute allowedCareerRoles={['FOUNDER']}>
                  <div>Founder Command HQ</div>
                </RoleRoute>
              }
            />
            <Route path="/unauthorized" element={<div>403 Access Denied</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('403 Access Denied')).toBeDefined();
    expect(screen.queryByText('Founder Command HQ')).toBeNull();
  });

  it('allows ADMIN platformRole to bypass careerRole restriction', () => {
    const adminUser = {
      ...DEFAULT_MOCK_USER,
      careerRole: 'NONE' as const,
      platformRole: 'ADMIN' as const,
    };

    render(
      <AuthProvider initialUser={adminUser}>
        <MemoryRouter initialEntries={['/founder']}>
          <Routes>
            <Route
              path="/founder"
              element={
                <RoleRoute allowedCareerRoles={['FOUNDER']}>
                  <div>Founder Command HQ</div>
                </RoleRoute>
              }
            />
            <Route path="/unauthorized" element={<div>403 Access Denied</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Founder Command HQ')).toBeDefined();
  });
});

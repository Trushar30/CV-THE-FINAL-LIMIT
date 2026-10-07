import type { ReactElement } from 'react';
import { Card } from '../components/ui/Card/Card';
import { Badge } from '../components/ui/Badge/Badge';
import { Button } from '../components/ui/Button/Button';
import { useAuth } from '../store/AuthContext';
import { useNavigate } from 'react-router-dom';

export function CareerHubPage(): ReactElement {
  return (
    <Card title="Job Seeker Career Hub" subtitle="Explore platform companies & track applications">
      <p style={{ color: 'var(--cv-text-secondary)', marginBottom: '1rem' }}>
        This view is restricted to users with <code>careerRole: JOB_SEEKER</code>.
      </p>
      <Badge variant="primary">Access Granted</Badge>
    </Card>
  );
}

export function WorkplacePage(): ReactElement {
  return (
    <Card title="Employee Workplace Dashboard" subtitle="Daily task portal & performance warnings">
      <p style={{ color: 'var(--cv-text-secondary)', marginBottom: '1rem' }}>
        This view is restricted to users with <code>careerRole: EMPLOYEE</code>.
      </p>
      <Badge variant="success">Access Granted</Badge>
    </Card>
  );
}

export function FounderHqPage(): ReactElement {
  return (
    <Card
      title="Founder Executive Headquarters"
      subtitle="Company command, P&L, and bot marketplace"
    >
      <p style={{ color: 'var(--cv-text-secondary)', marginBottom: '1rem' }}>
        This view is restricted to users with <code>careerRole: FOUNDER</code>.
      </p>
      <Badge variant="gold">Access Granted</Badge>
    </Card>
  );
}

export function AdminConsolePage(): ReactElement {
  return (
    <Card
      title="Platform Administration Console"
      subtitle="System controls, PlatformConfig & audit logs"
    >
      <p style={{ color: 'var(--cv-text-secondary)', marginBottom: '1rem' }}>
        This view is restricted to users with <code>platformRole: ADMIN</code>.
      </p>
      <Badge variant="warning">Superuser Access Granted</Badge>
    </Card>
  );
}

export function AiManagerPage(): ReactElement {
  return (
    <Card
      title="AI Infrastructure Console"
      subtitle="Provider routing, health diagnostics & fallbacks"
    >
      <p style={{ color: 'var(--cv-text-secondary)', marginBottom: '1rem' }}>
        This view is restricted to users with <code>platformRole: AI_MANAGER</code>.
      </p>
      <Badge variant="cyan">AI Operations Active</Badge>
    </Card>
  );
}

export function LoginPage(): ReactElement {
  const { loginStub, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 440, margin: '3rem auto' }}>
      <Card title="CorpVerse Authentication" subtitle="Sign in to your virtual corporate profile">
        <p
          style={{
            color: 'var(--cv-text-secondary)',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
          }}
        >
          Status: {isAuthenticated ? 'Currently Authenticated' : 'Unauthenticated (Guest)'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
          <Button
            variant="primary"
            onClick={() => {
              loginStub();
              navigate('/showcase');
            }}
          >
            Sign in as Demo User (Alex Chen)
          </Button>
          <Button variant="outline" onClick={() => navigate('/showcase')}>
            Continue to Component Showcase
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function UnauthorizedPage(): ReactElement {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 480, margin: '3rem auto' }}>
      <Card title="403 — Privileged Access Restricted" subtitle="Role requirements not met">
        <p
          style={{
            color: 'var(--cv-text-secondary)',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
          }}
        >
          You do not have the required <code>careerRole</code> or <code>platformRole</code> to
          access this view. Use the role switcher in the topbar to test different permission levels.
        </p>
        <Button variant="primary" onClick={() => navigate('/showcase')}>
          Return to Showcase
        </Button>
      </Card>
    </div>
  );
}

export function NotFoundPage(): ReactElement {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 480, margin: '3rem auto' }}>
      <Card title="404 — Resource Not Found" subtitle="Page route does not exist">
        <p
          style={{
            color: 'var(--cv-text-secondary)',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
          }}
        >
          The requested path does not map to any active simulation view.
        </p>
        <Button variant="primary" onClick={() => navigate('/showcase')}>
          Return to Showcase
        </Button>
      </Card>
    </div>
  );
}

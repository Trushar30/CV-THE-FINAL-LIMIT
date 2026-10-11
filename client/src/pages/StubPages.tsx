import type { ReactElement } from 'react';
import { Card } from '../components/ui/Card/Card';
import { Badge } from '../components/ui/Badge/Badge';
import { Button } from '../components/ui/Button/Button';
import { useAuth } from '../store/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShieldCheckIcon, FolderEmptyIcon, BriefcaseIcon } from '../components/ui/Icon/Icon';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function CareerHubPage(): ReactElement {
  const navigate = useNavigate();

  return (
    <Card title="Job Seeker Career Hub" subtitle="Explore platform companies & track applications">
      <p style={{ color: 'var(--cv-text-secondary)', marginBottom: '1rem' }}>
        Discover enterprise organizations and open simulation requisitions matching your track.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <Button variant="primary" size="md" onClick={() => navigate('/jobs')}>
          Browse Open Positions
        </Button>
        <Button variant="secondary" size="md" onClick={() => navigate('/companies')}>
          View Enterprises
        </Button>
      </div>
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
              navigate('/career');
            }}
          >
            Sign in as Demo User (Alex Chen)
          </Button>
          <Button variant="outline" onClick={() => navigate('/jobs')}>
            Explore Career Opportunities
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function UnauthorizedPage(): ReactElement {
  const navigate = useNavigate();
  useDocumentTitle('403 Access Restricted');

  return (
    <div style={{ maxWidth: 520, margin: '2.5rem auto', padding: '0 1rem' }}>
      <Card
        title="403 — Privileged Access Restricted"
        subtitle="Role requirements not satisfied"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1rem 0' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--cv-radius-full)',
              backgroundColor: 'rgba(235, 87, 87, 0.12)',
              color: '#eb5757',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <ShieldCheckIcon size={28} />
          </div>
          <p
            style={{
              color: 'var(--cv-text-secondary)',
              marginBottom: '1.25rem',
              fontSize: '0.9375rem',
              lineHeight: 1.6,
            }}
          >
            You do not have the required <code>careerRole</code> or <code>platformRole</code> to view this section.
            Please verify your active role credentials or test using the topbar simulation switcher.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            <Button variant="primary" onClick={() => navigate('/career')}>
              Return to Career Hub
            </Button>
            <Button variant="outline" onClick={() => navigate('/jobs')}>
              Explore Public Jobs
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function NotFoundPage(): ReactElement {
  const navigate = useNavigate();
  useDocumentTitle('404 Page Not Found');

  return (
    <div style={{ maxWidth: 520, margin: '2.5rem auto', padding: '0 1rem' }}>
      <Card
        title="404 — Simulation Route Not Found"
        subtitle="The requested virtual location does not exist"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1rem 0' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--cv-radius-full)',
              backgroundColor: 'rgba(39, 62, 65, 0.15)',
              color: 'var(--cv-color-cascades)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <FolderEmptyIcon size={28} />
          </div>
          <p
            style={{
              color: 'var(--cv-text-secondary)',
              marginBottom: '1.25rem',
              fontSize: '0.9375rem',
              lineHeight: 1.6,
            }}
          >
            The path you requested could not be resolved in the CorpVerse directory.
            Check the URL or return to one of our core corporate destinations below.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            <Button variant="primary" onClick={() => navigate('/career')}>
              Return to Career Hub
            </Button>
            <Button variant="outline" onClick={() => navigate('/jobs')} leftIcon={<BriefcaseIcon size={16} />}>
              Browse Jobs
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

import type { ReactElement } from 'react';

export function App(): ReactElement {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: 'rgba(17, 24, 39, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '3rem',
          maxWidth: '600px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            color: '#06b6d4',
            fontSize: '0.875rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
          }}
        >
          Phase 1 Foundation
        </div>
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          CorpVerse
        </h1>
        <p
          style={{
            color: '#9ca3af',
            fontSize: '1.125rem',
            lineHeight: 1.6,
            marginBottom: '2rem',
          }}
        >
          Gamified Virtual Corporate Simulation. Workspaces and foundation layer active.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            color: '#10b981',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 12px #10b981',
            }}
          />
          System Initialized & Online
        </div>
      </div>
    </main>
  );
}

export default App;

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Server Smoke & Health Suite', () => {
  it('should run a trivial assertion successfully', () => {
    expect(true).toBe(true);
  });

  it('should return 200 OK from /api/health endpoint', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('corpverse-server');
  });
});

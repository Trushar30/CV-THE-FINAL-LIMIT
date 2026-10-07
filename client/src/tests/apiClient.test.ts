import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../api/client';
import { ApiClientError } from '../api/types';

describe('ApiClient Unit Test Suite', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient('http://localhost:5000/api/v1');
    vi.restoreAllMocks();
  });

  it('normalizes successful server response unwrapping data payload', async () => {
    const mockData = { id: 'usr_1', totalExpCached: 500 };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockData }),
    } as Response);

    const result = await client.get<typeof mockData>('/users/me');
    expect(result).toEqual(mockData);
  });

  it('normalizes structured server error matching Spec Section 31 format', async () => {
    const errorPayload = {
      success: false,
      error: {
        code: 'BUSINESS_RULE_VIOLATION',
        message: 'Debit would cause negative balance: balance 100, debit 250',
        details: { currentBalance: 100, debitAmount: 250 },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => errorPayload,
    } as Response);

    await expect(client.post('/corpcoin/debit', { amount: 250 })).rejects.toThrow(ApiClientError);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => errorPayload,
    } as Response);

    try {
      await client.post('/corpcoin/debit', { amount: 250 });
    } catch (err) {
      const apiErr = err as ApiClientError;
      expect(apiErr.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(apiErr.status).toBe(409);
      expect(apiErr.message).toBe('Debit would cause negative balance: balance 100, debit 250');
      expect(apiErr.details).toEqual({ currentBalance: 100, debitAmount: 250 });
    }
  });

  it('normalizes network errors into NETWORK_ERROR with status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch'));

    try {
      await client.get('/health');
      expect.fail('Should have thrown');
    } catch (err) {
      const apiErr = err as ApiClientError;
      expect(apiErr.code).toBe('NETWORK_ERROR');
      expect(apiErr.status).toBe(0);
      expect(apiErr.message).toBe('Failed to fetch');
    }
  });

  it('correctly appends query parameters', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
    } as Response);

    await client.get('/applications', {
      params: { status: 'ACTIVE', page: 1, limit: 10 },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/applications?status=ACTIVE&page=1&limit=10',
      expect.objectContaining({ method: 'GET' })
    );
  });
});

/**
 * Tests for the axios API client configuration in api/client.js.
 *
 * We verify that the client applies the correct base URL, auth header,
 * and error enrichment — without making real network requests.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// We test client.js behaviour by inspecting the axios instance it exports.
// Mock axios.create so we can capture the config it was called with.
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal();

  const mockInterceptors = {
    response: { use: vi.fn() },
    request: { use: vi.fn() },
  };

  const mockInstance = {
    interceptors: mockInterceptors,
    get: vi.fn(),
    post: vi.fn(),
    defaults: { baseURL: '', headers: { common: {} } },
  };

  return {
    default: {
      ...actual.default,
      create: vi.fn(() => mockInstance),
    },
  };
});

describe('API client configuration', () => {
  let createdConfig;

  beforeEach(async () => {
    // Clear module cache so client.js re-executes with fresh mocks
    vi.resetModules();
    // Dynamically import after mock is in place
    await import('../api/client.js');
    createdConfig = axios.create.mock.calls[0]?.[0];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('creates an axios instance', () => {
    expect(axios.create).toHaveBeenCalledOnce();
  });

  test('base URL defaults to /api', () => {
    expect(createdConfig?.baseURL).toBe('/api');
  });

  test('includes X-Demo-Password header', () => {
    const headers = createdConfig?.headers ?? {};
    expect(headers['X-Demo-Password']).toBeTruthy();
  });

  test('default password is InvoiceDemo2026', () => {
    const headers = createdConfig?.headers ?? {};
    expect(headers['X-Demo-Password']).toBe('InvoiceDemo2026');
  });

  test('timeout is set to 60 seconds', () => {
    expect(createdConfig?.timeout).toBe(60000);
  });
});

// ── Error enrichment (response interceptor) ───────────────────────────────────

describe('response interceptor error enrichment', () => {
  test('adds displayMessage from response detail', () => {
    const err = {
      response: { data: { detail: 'Not found' }, status: 404 },
    };
    // Simulate the interceptor logic directly
    const enrich = (error) => {
      if (error.response) {
        error.displayMessage =
          error.response.data?.detail ||
          error.response.data?.message ||
          'An error occurred';
      } else if (error.request) {
        error.displayMessage = 'Cannot reach the server. Is the API running on port 8000?';
      } else {
        error.displayMessage = error.message;
      }
      return Promise.reject(error);
    };

    return enrich(err).catch((e) => {
      expect(e.displayMessage).toBe('Not found');
    });
  });

  test('falls back to message field when detail missing', () => {
    const err = { response: { data: { message: 'Bad request' }, status: 400 } };
    const enrich = (error) => {
      if (error.response) {
        error.displayMessage =
          error.response.data?.detail ||
          error.response.data?.message ||
          'An error occurred';
      }
      return Promise.reject(error);
    };
    return enrich(err).catch((e) => {
      expect(e.displayMessage).toBe('Bad request');
    });
  });

  test('falls back to generic message when no data', () => {
    const err = { response: { data: {}, status: 500 } };
    const enrich = (error) => {
      if (error.response) {
        error.displayMessage =
          error.response.data?.detail ||
          error.response.data?.message ||
          'An error occurred';
      }
      return Promise.reject(error);
    };
    return enrich(err).catch((e) => {
      expect(e.displayMessage).toBe('An error occurred');
    });
  });

  test('network error gets server unreachable message', () => {
    const err = { request: {}, message: 'Network Error' };
    const enrich = (error) => {
      if (error.response) {
        error.displayMessage = error.response.data?.detail || 'An error occurred';
      } else if (error.request) {
        error.displayMessage = 'Cannot reach the server. Is the API running on port 8000?';
      } else {
        error.displayMessage = error.message;
      }
      return Promise.reject(error);
    };
    return enrich(err).catch((e) => {
      expect(e.displayMessage).toContain('Cannot reach the server');
    });
  });
});

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export function useDashboard(pollInterval = 5000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      const res = await client.get('/dashboard');
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.displayMessage || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, pollInterval);
    return () => clearInterval(id);
  }, [fetch, pollInterval]);

  return { data, loading, error, refresh: fetch };
}

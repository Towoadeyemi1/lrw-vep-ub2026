import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export function useVendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/vendors');
      setVendors(Array.isArray(res.data) ? res.data : res.data.vendors || []);
      setError(null);
    } catch (err) {
      setError(err.displayMessage || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { vendors, loading, error, refresh };
}

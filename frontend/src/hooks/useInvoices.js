import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export function useInvoices(pageSize = 20) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    entity: '',
    tier: '',
    status: '',
    source: '',
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        skip: (page - 1) * pageSize,
        limit: pageSize,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      };
      const res = await client.get('/invoices', { params });
      const d = res.data;
      if (Array.isArray(d)) {
        setInvoices(d);
        setTotal(d.length);
      } else {
        setInvoices(d.invoices || d.items || []);
        setTotal(d.total || d.count || 0);
      }
      setError(null);
    } catch (err) {
      setError(err.displayMessage || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    invoices,
    loading,
    error,
    total,
    page,
    totalPages,
    setPage,
    filters,
    setFilters,
    refresh: fetch,
  };
}

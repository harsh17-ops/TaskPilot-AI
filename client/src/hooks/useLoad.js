import { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';

/**
 * Custom hook for standard GET requests with loading and error states.
 * 
 * @param {string} url - API endpoint to request (e.g. '/tasks', '/analytics/summary')
 * @param {number|any} [refresh=0] - Dependency trigger that refetches data when changed
 * @returns {{ data: any, error: string, busy: boolean, reload: Function, setData: Function }}
 */
export function useLoad(url, refresh = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await api.get(url);
      setData(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load data.');
    } finally {
      setBusy(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load, refresh]);

  return { data, error, busy, reload: load, setData };
}

export default useLoad;

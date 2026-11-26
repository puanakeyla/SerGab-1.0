import { useCallback, useEffect, useState } from 'react';
import { api, pesanKegagalan } from './api';

/** GET sederhana dengan status muat & muat-ulang (untuk tarik-untuk-segarkan). */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  const muatUlang = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(pesanKegagalan(e));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void muatUlang();
  }, [muatUlang]);

  return { data, error, loading, muatUlang };
}

import { useCallback, useEffect, useState } from 'react';
import type { Page, PageLoader } from '../lib/types';

const DEFAULT_PAGE_SIZE = 15;

export function usePagedData<T>(loadPage: PageLoader<T>, pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [settled, setSettled] = useState<{
    loadPage: PageLoader<T>;
    page: number;
    pageSize: number;
    reloadToken: number;
    result?: Page<T>;
    error?: string;
  } | null>(null);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    void loadPage(page, pageSize)
      .then((result: Page<T>) => {
        if (!active) return;
        setSettled({ loadPage, page, pageSize, reloadToken, result });
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setSettled({
          loadPage,
          page,
          pageSize,
          reloadToken,
          error: loadError instanceof Error ? loadError.message : 'Unable to load records.',
        });
      });
    return () => {
      active = false;
    };
  }, [loadPage, page, pageSize, reloadToken]);

  const isCurrentRequest = settled?.loadPage === loadPage
    && settled.page === page
    && settled.pageSize === pageSize
    && settled.reloadToken === reloadToken;
  const rows = isCurrentRequest ? settled.result?.rows ?? [] : [];
  const count = isCurrentRequest ? settled.result?.count ?? 0 : 0;
  const loading = !isCurrentRequest;
  const error = isCurrentRequest ? settled.error ?? null : null;

  return {
    rows,
    count,
    page,
    pageSize,
    loading,
    error,
    refresh,
    setPage,
    pageCount: Math.max(1, Math.ceil(count / pageSize)),
  };
}

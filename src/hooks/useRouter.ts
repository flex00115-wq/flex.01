import { useCallback, useEffect, useState } from 'react';

export interface RouteState {
  pathname: string;
  search: string;
}

export function navigateTo(to: string) {
  const url = new URL(to, window.location.origin);
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return;
  }
  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function useRouter() {
  const [route, setRoute] = useState<RouteState>(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  }));

  useEffect(() => {
    const onPop = () => {
      setRoute({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    navigateTo(to);
  }, []);

  const searchParams = new URLSearchParams(route.search);

  return {
    pathname: route.pathname,
    search: route.search,
    searchParams,
    navigate,
  };
}

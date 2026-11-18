import { useCallback, useEffect, useState } from 'react';
import { getAppBasePath, shouldUseHashRouting } from '../utils/assetUrl';

export interface RouteState {
  pathname: string;
  search: string;
}

function normalizeRoutePath(rawPathname: string): string {
  const base = getAppBasePath();
  let path = rawPathname || '/';

  if (base !== '/' && path.startsWith(base.slice(0, -1))) {
    path = path.slice(base.length - 1) || '/';
  }

  if (path === '/index.html' || path === '') {
    return '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

function readCurrentRoute(): RouteState {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '' };
  }

  // Handle hash routes (#/scan?mode=camera) on GitHub Pages or static subpath hosts
  const rawHash = window.location.hash;
  if (rawHash.startsWith('#/')) {
    const hashUrl = new URL(rawHash.slice(1), window.location.origin);
    return {
      pathname: hashUrl.pathname || '/',
      search: hashUrl.search || '',
    };
  }

  if (shouldUseHashRouting()) {
    // Handle query-redirect fallback (?p=/scan) if arrived via external link
    const params = new URLSearchParams(window.location.search);
    const redirected = params.get('p');
    if (redirected) {
      const url = new URL(redirected, window.location.origin);
      return {
        pathname: url.pathname || '/',
        search: url.search || '',
      };
    }
    return {
      pathname: normalizeRoutePath(window.location.pathname),
      search: window.location.search || '',
    };
  }

  return {
    pathname: normalizeRoutePath(window.location.pathname),
    search: window.location.search || '',
  };
}

export function navigateTo(to: string) {
  const url = new URL(to, window.location.origin);
  const current = readCurrentRoute();

  if (url.pathname === current.pathname && url.search === current.search) {
    return;
  }

  if (shouldUseHashRouting()) {
    const nextHash = `#${url.pathname}${url.search}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function useRouter() {
  const [route, setRoute] = useState<RouteState>(() => readCurrentRoute());

  useEffect(() => {
    const onRouteChange = () => {
      setRoute(readCurrentRoute());
    };
    window.addEventListener('popstate', onRouteChange);
    window.addEventListener('hashchange', onRouteChange);
    return () => {
      window.removeEventListener('popstate', onRouteChange);
      window.removeEventListener('hashchange', onRouteChange);
    };
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

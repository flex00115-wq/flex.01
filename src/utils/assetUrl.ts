const APP_ROUTE_ROOTS = new Set([
  'scan',
  'marketplace',
  'categories',
  'trade',
  'flex-admin',
  'card',
]);

let cachedBasePath: string | null = null;

/**
 * Detects the runtime mount base path (e.g. "/" at root or "/flex-cards/" on GitHub Pages)
 * without requiring users to hardcode their repository name.
 */
export function getAppBasePath(): string {
  if (cachedBasePath !== null) {
    return cachedBasePath;
  }

  // Honor explicit Vite BASE_URL when configured as an absolute subpath (e.g. "/my-repo/")
  const envBase =
    typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL;
  if (typeof envBase === 'string' && envBase.startsWith('/') && envBase !== '/') {
    cachedBasePath = envBase.endsWith('/') ? envBase : `${envBase}/`;
    return cachedBasePath;
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // 1. Resolve from bundled Vite script or stylesheet containing "/assets/"
    const assetNodes = document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
      'script[type="module"][src], link[rel="stylesheet"][href]'
    );
    for (const node of assetNodes) {
      const rawUrl = 'src' in node ? node.src : node.href;
      if (!rawUrl) continue;
      try {
        const parsed = new URL(rawUrl, window.location.href);
        const idx = parsed.pathname.lastIndexOf('/assets/');
        if (idx >= 0) {
          cachedBasePath = parsed.pathname.slice(0, idx + 1) || '/';
          return cachedBasePath;
        }
      } catch {
        // ignore invalid URL
      }
    }

    // 2. Fallback heuristic for GitHub Pages project URLs when script path isn't "/assets/"
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (
      window.location.hostname.endsWith('.github.io') &&
      segments.length > 0 &&
      !APP_ROUTE_ROOTS.has(segments[0]) &&
      segments[0] !== 'index.html'
    ) {
      cachedBasePath = `/${segments[0]}/`;
      return cachedBasePath;
    }
  }

  cachedBasePath = '/';
  return cachedBasePath;
}

/**
 * Resolves root-relative public URLs (e.g. "/catalog.json", "/cards/flex-pkm-001.svg")
 * so they work on both root hosting ("/") and GitHub Pages subpaths ("/<repo>/").
 */
export function resolvePublicAssetUrl(url: string): string {
  if (!url) return url;
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url;
  }

  const base = getAppBasePath();
  if (base !== '/' && url.startsWith(base)) {
    return url;
  }
  if (url.startsWith('/')) {
    return `${base}${url.slice(1)}`;
  }
  if (url.startsWith('./')) {
    return `${base}${url.slice(2)}`;
  }
  return `${base}${url}`;
}

/**
 * Strips the deployment subpath back to portable root-relative "/..." for catalog.json exports.
 */
export function toPortableAssetUrl(url: string): string {
  if (!url) return url;
  const base = getAppBasePath();
  if (base !== '/' && url.startsWith(base)) {
    return `/${url.slice(base.length)}`;
  }
  return url;
}

/**
 * Uses hash routing automatically on GitHub Pages / subpath deployments so refreshes and
 * relative asset resolution never 404 or lose the "/<repo>/" mount prefix.
 */
export function shouldUseHashRouting(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'file:') return true;
  if (window.location.hostname.endsWith('.github.io')) return true;
  if (getAppBasePath() !== '/') return true;
  if (window.location.hash.startsWith('#/')) return true;
  return false;
}

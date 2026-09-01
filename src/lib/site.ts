const LOCAL_SITE_URL = 'http://localhost:3000';
const PRODUCTION_SITE_URL = 'https://stanparty.katsudon.app';

function isUnsafeProductionUrl(url: URL): boolean {
  if (process.env.NODE_ENV !== 'production') return false;

  return (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]' ||
    url.hostname.endsWith('.vercel.app')
  );
}

function resolveSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (configuredUrl) {
    const url = new URL(configuredUrl);
    if (!isUnsafeProductionUrl(url)) return url;
  }

  if (vercelProductionHost) {
    const url = new URL(`https://${vercelProductionHost}`);
    if (!isUnsafeProductionUrl(url)) return url;
  }

  if (process.env.NODE_ENV === 'production') return new URL(PRODUCTION_SITE_URL);

  return new URL(LOCAL_SITE_URL);
}

export const SITE_URL = resolveSiteUrl();
export const SITE_ORIGIN = SITE_URL.origin;
export const REPOSITORY_URL = 'https://github.com/katsudontech/stanparty';
export const SUPPORT_ISSUE_URL = `${REPOSITORY_URL}/issues/new`;
export const SUPPORT_ISSUES_URL = `${REPOSITORY_URL}/issues`;
export const OPERATOR_PROFILE_URL = 'https://github.com/katsudontech';

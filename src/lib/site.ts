const LOCAL_SITE_URL = 'http://localhost:3000';

function resolveSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (configuredUrl) return new URL(configuredUrl);
  if (vercelProductionHost) return new URL(`https://${vercelProductionHost}`);

  return new URL(LOCAL_SITE_URL);
}

export const SITE_URL = resolveSiteUrl();
export const SITE_ORIGIN = SITE_URL.origin;
export const REPOSITORY_URL = 'https://github.com/katsudontech/stanparty';
export const SUPPORT_ISSUE_URL = `${REPOSITORY_URL}/issues/new`;
export const SUPPORT_ISSUES_URL = `${REPOSITORY_URL}/issues`;
export const OPERATOR_PROFILE_URL = 'https://github.com/katsudontech';

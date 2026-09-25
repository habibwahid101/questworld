export type AuthConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
};

/**
 * Public Cognito identifiers for the deployed pool.
 * These are not secrets. Environment variables override them when set.
 * A production .env file is not committed; Amplify can inject the same values later.
 */
export const DEPLOYED_PUBLIC_AUTH: AuthConfig = {
  region: "ap-south-1",
  userPoolId: "ap-south-1_X2ibT0rBo",
  clientId: "4djbqt27hj54c3tu5754g4pvgt",
};

function pick(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || fallback;
}

export function readAuthConfig(
  env?: Record<string, string | undefined>,
): AuthConfig {
  const source = env ?? {
    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  };

  return {
    region: pick(source.NEXT_PUBLIC_AWS_REGION, DEPLOYED_PUBLIC_AUTH.region),
    userPoolId: pick(source.NEXT_PUBLIC_COGNITO_USER_POOL_ID, DEPLOYED_PUBLIC_AUTH.userPoolId),
    clientId: pick(source.NEXT_PUBLIC_COGNITO_CLIENT_ID, DEPLOYED_PUBLIC_AUTH.clientId),
  };
}

export function isAuthConfigured(config: AuthConfig = readAuthConfig()): boolean {
  if (!config.region || !config.userPoolId || !config.clientId) {
    return false;
  }
  if (/example|changeme|x{3,}/i.test(`${config.userPoolId}${config.clientId}`)) {
    return false;
  }
  return true;
}

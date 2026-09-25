export type AuthConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
};

export function readAuthConfig(
  env: Record<string, string | undefined> = process.env,
): AuthConfig {
  return {
    region: env.NEXT_PUBLIC_AWS_REGION?.trim() ?? "",
    userPoolId: env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim() ?? "",
    clientId: env.NEXT_PUBLIC_COGNITO_CLIENT_ID?.trim() ?? "",
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

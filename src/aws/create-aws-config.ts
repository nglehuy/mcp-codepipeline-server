import AWS from 'aws-sdk';
import { getEnv } from '../utils/env.js';

export type AwsCredentialMode = 'env-keys' | 'default-chain';

export interface AwsConfigResult {
  config: AWS.ConfigurationOptions;
  region: string;
  credentialMode: AwsCredentialMode;
  profile?: string;
}

/**
 * Build AWS SDK configuration from environment variables.
 * Uses static keys when AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set;
 * otherwise relies on the SDK default credential provider chain
 * (~/.aws/credentials, AWS_PROFILE, SSO, IAM roles, etc.).
 */
export function createAwsConfig(): AwsConfigResult {
  const region = getEnv('AWS_REGION', 'us-west-2');
  const accessKeyId = getEnv('AWS_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('AWS_SECRET_ACCESS_KEY');
  const sessionToken = getEnv('AWS_SESSION_TOKEN');
  const profile = getEnv('AWS_PROFILE');

  const awsConfig: AWS.ConfigurationOptions = { region };
  let credentialMode: AwsCredentialMode = 'default-chain';

  if (accessKeyId && secretAccessKey) {
    awsConfig.credentials = new AWS.Credentials({
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    });
    credentialMode = 'env-keys';
  }

  AWS.config.update(awsConfig);

  return {
    config: awsConfig,
    region,
    credentialMode,
    profile: profile || undefined,
  };
}

export function logAwsConfig({ region, credentialMode, profile }: AwsConfigResult): void {
  console.log('AWS_REGION:', region);

  if (profile) {
    console.log('AWS_PROFILE:', profile);
  }

  if (credentialMode === 'env-keys') {
    console.log('AWS credentials: static keys from environment variables');
    if (getEnv('AWS_SESSION_TOKEN')) {
      console.log('AWS_SESSION_TOKEN: set');
    }
    return;
  }

  console.log('AWS credentials: default provider chain');
  if (!profile) {
    console.log('  Tip: set AWS_PROFILE to use a named profile from ~/.aws/credentials');
  }
}

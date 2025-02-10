import * as cdk from 'aws-cdk-lib';

export interface ApiGatewayConfig {
  requireApiKey: boolean;
  stageName: string;
  logLevel: string;
}

export interface EnvironmentConfig {
  apiGateway: ApiGatewayConfig;
}

export function getConfig(scope: cdk.Stack): EnvironmentConfig {
  const environment = scope.node.tryGetContext('environment') || 'local';
  const config = scope.node.tryGetContext(environment);
  
  if (!config) {
    throw new Error(`No configuration found for environment: ${environment}`);
  }
  
  return config;
} 
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface LambdaPythonFunctionProps {
  entry: string;
  environment?: { [key: string]: string };
  timeout?: cdk.Duration;
  memorySize?: number;
  layer: lambda.LayerVersion;
  architecture?: lambda.Architecture;
}

export class LambdaPythonFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props: LambdaPythonFunctionProps) {
    const functionDir = path.basename(props.entry);
    const stack = cdk.Stack.of(scope);
    const environment = stack.node.tryGetContext('environment');
    const config = stack.node.tryGetContext(environment);
    
    super(scope, id, {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: `${functionDir}.handler`,
      code: lambda.Code.fromAsset(props.entry),
      layers: [props.layer],
      timeout: props.timeout || cdk.Duration.seconds(30),
      memorySize: props.memorySize || 256,
      environment: {
        POWERTOOLS_SERVICE_NAME: id,
        LOG_LEVEL: config?.apiGateway?.logLevel || 'ERROR',
        ...props.environment,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      architecture: lambda.Architecture.X86_64,
    });
  }
} 
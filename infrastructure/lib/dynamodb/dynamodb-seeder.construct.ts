import * as path from 'path';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Stack } from 'aws-cdk-lib';

export interface DynamoDBSeederProps {
  table: dynamodb.Table;
  seedDataFile: string;  // Just the filename, e.g., 'consensus-request.json'
}

export class DynamoDBSeeder extends Construct {
  constructor(scope: Construct, id: string, props: DynamoDBSeederProps) {
    super(scope, id);

    // Get environment from CDK context
    const stack = Stack.of(scope);
    const environment = stack.node.tryGetContext('environment') || 'dev';

    // Create Lambda function to handle seeding
    const seederFunction = new NodejsFunction(this, 'SeederFunction', {
      entry: path.join(__dirname, 'lambda', 'dynamodb-seeder.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: props.table.tableName,
        SEED_DATA_FILE: props.seedDataFile,
        ENVIRONMENT: environment,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        // Copy seed data files to Lambda
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            const seedDataDir = path.join(inputDir, 'lib', 'dynamodb', 'seed-data');
            return [
              // Create environment directories in Lambda
              `mkdir -p ${outputDir}/seed-data/{local,dev,uat,prod}`,
              // Copy environment-specific seed data while maintaining directory structure
              `cp ${seedDataDir}/local/* ${outputDir}/seed-data/local/ 2>/dev/null || :`,
              `cp ${seedDataDir}/dev/* ${outputDir}/seed-data/dev/ 2>/dev/null || :`,
              `cp ${seedDataDir}/uat/* ${outputDir}/seed-data/uat/ 2>/dev/null || :`,
              `cp ${seedDataDir}/prod/* ${outputDir}/seed-data/prod/ 2>/dev/null || :`,
              // Install dependencies
              `cd ${path.join(inputDir, 'lib', 'dynamodb', 'lambda')} && npm install`,
            ];
          },
          beforeInstall() {
            return [];
          },
          afterBundling() {
            return [];
          },
        },
      },
    //   depsLockFilePath: path.join(__dirname, 'lambda', 'package-lock.json'),
    });

    // Grant permissions to the seeder function
    props.table.grantWriteData(seederFunction);

    // Create custom resource to trigger seeding
    const customResource = new cr.AwsCustomResource(this, 'SeedingResource', {
      onUpdate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: seederFunction.functionName,
          Payload: JSON.stringify({
            RequestType: 'Update',
            ResourceProperties: {
              timestamp: Date.now(),
            },
          }),
        },
        physicalResourceId: cr.PhysicalResourceId.of(`${props.table.tableName}-seeder`),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [seederFunction.functionArn],
        }),
      ]),
    });

    // Add explicit dependency to ensure the function exists before the custom resource tries to invoke it
    customResource.node.addDependency(seederFunction);
  }
} 
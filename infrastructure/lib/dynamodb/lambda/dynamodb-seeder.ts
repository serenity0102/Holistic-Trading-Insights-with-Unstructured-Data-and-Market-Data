import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse, Context } from 'aws-lambda';
import * as fs from 'fs';
import * as path from 'path';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

interface SeedData {
  configItems: Array<{
    pk: string;
    sk: string;
    configValue: any;
  }>;
}

export const handler = async (event: CloudFormationCustomResourceEvent, context: Context): Promise<CloudFormationCustomResourceResponse> => {
  const physicalId = `${process.env.TABLE_NAME}-seeder`;
  
  try {
    console.log('Event:', JSON.stringify(event, null, 2));
    const tableName = process.env.TABLE_NAME!;
    const seedDataFile = process.env.SEED_DATA_FILE!;
    const environment = process.env.ENVIRONMENT!;

    // Construct the environment-specific path
    const seedDataPath = path.join(__dirname, 'seed-data', environment, seedDataFile);
    console.log('Reading seed data from:', seedDataPath);
    
    if (!fs.existsSync(seedDataPath)) {
      throw new Error(`Seed data file not found: ${seedDataPath}. Environment: ${environment}`);
    }

    const seedData: SeedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));
    console.log('Seed data:', JSON.stringify(seedData, null, 2));

    // Process each config item
    for (const item of seedData.configItems) {
      console.log('Writing item:', JSON.stringify(item, null, 2));
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: item,
      }));
    }

    return {
      Status: 'SUCCESS',
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      PhysicalResourceId: physicalId,
      StackId: event.StackId,
      Data: {},
    };
  } catch (error) {
    console.error('Error seeding DynamoDB:', error);
    return {
      Status: 'FAILED',
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      PhysicalResourceId: physicalId,
      StackId: event.StackId,
      Reason: error instanceof Error ? error.message : 'Unknown error',
      Data: {},
    };
  }
}; 
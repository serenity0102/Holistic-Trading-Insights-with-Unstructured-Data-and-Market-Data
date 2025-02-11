import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiStack } from "./stacks/api.stack";
import { DynamoDBStack } from "./stacks/dynamodb.stack";
import { WorkflowStack } from "./stacks/workflow.stack";
import { StorageStack } from "./stacks/storage.stack";
import { Tags } from "aws-cdk-lib";

export class TradingInsightStack extends cdk.Stack {
  public readonly apiStack: ApiStack;
  public readonly dynamodbStack: DynamoDBStack;
  public readonly workflowStack: WorkflowStack;
  public readonly storageStack: StorageStack;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    Tags.of(this).add("AppManagerCFNStackKey", "TradingInsightStack");

    // Get environment from context
    const environment = this.node.tryGetContext("environment") || "dev";

    // Create Storage Stack
    this.storageStack = new StorageStack(this, "StorageStack", {
      description: "Storage nested stack containing S3 buckets",
      environment: environment,
    });

    // Create DynamoDB Stack
    this.dynamodbStack = new DynamoDBStack(this, "DynamoDBStack", {
      description: "DynamoDB nested stack containing database tables",
      environment: environment,
    });

    // Create API Stack as nested stack with dependencies
    this.apiStack = new ApiStack(this, "ApiStack", {
      description:
        "API nested stack containing API Gateway and Lambda functions",
      dynamodbStack: this.dynamodbStack,
      environment: environment,
    });

    // Create Workflow Stack
    this.workflowStack = new WorkflowStack(this, "WorkflowStack", {
      description: "Workflow nested stack containing Step Functions",
      environment: environment,
      dynamodbStack: this.dynamodbStack,
      storageStack: this.storageStack,
    });
  }
}

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { DynamoDBStack } from "./stacks/dynamodb.stack";
import { StorageStack } from "./stacks/storage.stack";
import { WorkflowStack } from "./stacks/workflow.stack";
import { Tags } from "aws-cdk-lib";
import { OpenSearchStack } from "./stacks/opensearch.stack";

export class TradingInsightStack extends cdk.Stack {
  public readonly dynamodbStack: DynamoDBStack;
  public readonly storageStack: StorageStack;
  public readonly workflowStack: WorkflowStack;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    Tags.of(this).add("AppManagerCFNStackKey", "TradingInsightStack");

    // Get environment from context
    const environment = this.node.tryGetContext("environment") || "dev";

    // Create DynamoDB Stack first
    this.dynamodbStack = new DynamoDBStack(this, "DynamoDBStack", {
      description: "DynamoDB nested stack containing tables",
      environment: environment,
    });

    // Create OpenSearch stack
    const openSearchStack = new OpenSearchStack(this, "OpenSearchStack", {
      environment: environment,
      reportTable: this.dynamodbStack.reportTable.table,
    });

    // Then create Storage Stack with DynamoDB table reference
    this.storageStack = new StorageStack(this, "StorageStack", {
      description: "Storage nested stack containing S3 buckets and search",
      environment: environment,
      reportTable: this.dynamodbStack.reportTable.table,
    });

    // Finally create Workflow Stack
    this.workflowStack = new WorkflowStack(this, "WorkflowStack", {
      description: "Workflow nested stack containing Step Functions",
      environment: environment,
      dynamodbStack: this.dynamodbStack,
      storageStack: this.storageStack,
    });
  }
}

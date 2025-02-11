import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";

export class ReportTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Get environment from CDK context
    const stack = Stack.of(scope);
    const environment = stack.node.tryGetContext("environment");
    const isDevEnvironment = environment === "local" || environment === "dev";

    this.table = new dynamodb.Table(this, "ReportTable", {
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isDevEnvironment
        ? cdk.RemovalPolicy.DESTROY
        : cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // Enable streaming for future use
    });
  }
}

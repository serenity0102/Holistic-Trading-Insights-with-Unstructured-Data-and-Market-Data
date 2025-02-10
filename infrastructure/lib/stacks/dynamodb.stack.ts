import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { HelloWorldTable } from "../dynamodb/hello-world-table.construct";
import { ReportTable } from "../dynamodb/report-table.construct";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";

export interface DynamoDBStackProps extends NestedStackProps {
  environment?: string;
}

export class DynamoDBStack extends NestedStack {
  public readonly helloWorldTable: HelloWorldTable;
  public readonly reportTable: ReportTable;

  constructor(scope: Construct, id: string, props?: DynamoDBStackProps) {
    super(scope, id, props);

    // Create Hello World table
    this.helloWorldTable = new HelloWorldTable(this, "HelloWorldTable");

    // Create Report table
    this.reportTable = new ReportTable(this, "ReportTable");
  }
}

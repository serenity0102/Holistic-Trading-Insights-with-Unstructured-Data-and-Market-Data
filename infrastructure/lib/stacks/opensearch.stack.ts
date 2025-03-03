import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { OpenSearchServerlessCollection } from "../opensearch/opensearch-serverless.construct";
import { Table } from "aws-cdk-lib/aws-dynamodb";

export interface OpenSearchStackProps extends NestedStackProps {
  environment?: string;
  reportTable: Table;
}

export class OpenSearchStack extends NestedStack {
  public readonly reportSearchCollection: OpenSearchServerlessCollection;
  public readonly endpoint: string;

  constructor(scope: Construct, id: string, props: OpenSearchStackProps) {
    super(scope, id, props);

    // Create OpenSearch Serverless collection for report data
    this.reportSearchCollection = new OpenSearchServerlessCollection(
      this,
      "ReportSearchCollection",
      {
        reportTable: props.reportTable,
        environment: props.environment,
      }
    );

    // Expose the endpoint from the collection
    this.endpoint = this.reportSearchCollection.endpoint;
  }
}

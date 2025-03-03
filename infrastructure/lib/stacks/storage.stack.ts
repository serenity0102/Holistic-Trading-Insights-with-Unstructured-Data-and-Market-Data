import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ReportExtractionsBucket } from "../storage/report-extractions-bucket.construct";
import { ReportSearch } from "../storage/report-search.construct";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { Table } from "aws-cdk-lib/aws-dynamodb";

export interface StorageStackProps extends NestedStackProps {
  environment?: string;
  reportTable: Table;
}

export class StorageStack extends NestedStack {
  public readonly reportExtractionsBucket: ReportExtractionsBucket;
  public readonly reportSearch: ReportSearch;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // Create Report Extractions bucket
    this.reportExtractionsBucket = new ReportExtractionsBucket(
      this,
      "ReportExtractionsBucket"
    );

    // Create OpenSearch Serverless collection with Zero ETL
    this.reportSearch = new ReportSearch(this, "ReportSearch", {
      reportTable: props.reportTable,
    });
  }
}

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ReportExtractionsBucket } from "../storage/report-extractions-bucket.construct";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";

export interface StorageStackProps extends NestedStackProps {
  environment?: string;
}

export class StorageStack extends NestedStack {
  public readonly reportExtractionsBucket: ReportExtractionsBucket;

  constructor(scope: Construct, id: string, props?: StorageStackProps) {
    super(scope, id, props);

    // Create Report Extractions bucket
    this.reportExtractionsBucket = new ReportExtractionsBucket(
      this,
      "ReportExtractionsBucket"
    );
  }
}

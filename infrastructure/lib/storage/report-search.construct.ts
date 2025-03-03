import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as opensearchserverless from "aws-cdk-lib/aws-opensearchserverless";
import * as iam from "aws-cdk-lib/aws-iam";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import * as cr from "aws-cdk-lib/custom-resources";
import * as lambda from "aws-cdk-lib/aws-lambda";

export interface ReportSearchProps {
  reportTable: Table;
}

export class ReportSearch extends Construct {
  public readonly collection: opensearchserverless.CfnCollection;

  constructor(scope: Construct, id: string, props: ReportSearchProps) {
    super(scope, id);
  }
}

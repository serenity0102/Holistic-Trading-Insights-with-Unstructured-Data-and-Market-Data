import * as cdk from "aws-cdk-lib";
import * as opensearchserverless from "aws-cdk-lib/aws-opensearchserverless";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { Table } from "aws-cdk-lib/aws-dynamodb";

export interface ReportSearchProps {
  reportTable: Table;
  environment?: string;
}

export class OpenSearchServerlessCollection extends Construct {
  public readonly collection: opensearchserverless.CfnCollection;
  public readonly endpoint: string;

  constructor(scope: Construct, id: string, props: ReportSearchProps) {
    super(scope, id);

    // Get environment for resource naming
    const env = (props.environment || "dev").toLowerCase();

    // Create short unique prefix for naming resources
    const prefix = `trading-${env}`;

    // Create encryption policy with compliant name
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      "EncryptionPolicy",
      {
        name: `${prefix}-encryption`,
        type: "encryption",
        policy: JSON.stringify({
          Rules: [
            {
              ResourceType: "collection",
              Resource: ["collection/*"],
            },
          ],
          AWSOwnedKey: true,
        }),
      }
    );

    // Create network policy for public access
    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      "NetworkPolicy",
      {
        name: `${prefix}-network`,
        type: "network",
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: "collection",
                Resource: ["collection/*"],
              },
              {
                ResourceType: "dashboard",
                Resource: ["collection/*"],
              },
            ],
            AllowFromPublic: true,
          },
        ]),
      }
    );

    // Create IAM role for OpenSearch access
    const openSearchRole = new iam.Role(this, "OpenSearchRole", {
      assumedBy: new iam.ServicePrincipal("aoss.amazonaws.com"),
      description: "Role for OpenSearch Serverless to access DynamoDB streams",
    });

    // Grant the role permissions to read from the DynamoDB table's stream
    props.reportTable.grantStreamRead(openSearchRole);

    // Allow AWS Bedrock (for Cohere Embed v3) permissions
    openSearchRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:${
            cdk.Stack.of(this).region
          }::foundation-model/cohere.embed-english-v3`,
        ],
      })
    );

    // Create data access policy with proper IAM role as principal
    const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(
      this,
      "DataAccessPolicy",
      {
        name: `${prefix}-data-access`,
        type: "data",
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: "index",
                Resource: ["index/*/*"],
                Permission: ["aoss:*"],
              },
              {
                ResourceType: "collection",
                Resource: ["collection/*"],
                Permission: ["aoss:*"],
              },
            ],
            Principal: [
              openSearchRole.roleArn,
              `arn:aws:iam::${cdk.Stack.of(this).account}:root`,
            ],
          },
        ]),
      }
    );

    // Create OpenSearch Serverless collection
    this.collection = new opensearchserverless.CfnCollection(
      this,
      "ReportCollection",
      {
        name: `${prefix}-reports`,
        type: "VECTORSEARCH",
        description:
          "Collection for report data with vector search capabilities",
        standbyReplicas: "DISABLED",
      }
    );

    // Set dependencies to ensure policies are created before the collection
    this.collection.addDependency(encryptionPolicy);
    this.collection.addDependency(networkPolicy);
    this.collection.addDependency(dataAccessPolicy);

    // Export the collection endpoint
    this.endpoint = this.collection.attrCollectionEndpoint;

    // Add output with the collection endpoint
    new cdk.CfnOutput(this, "OpenSearchEndpoint", {
      value: this.endpoint,
      description: "OpenSearch Serverless collection endpoint",
      exportName: `${cdk.Stack.of(this).stackName}-OpenSearchEndpoint`,
    });
  }
}

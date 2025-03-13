import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { LambdaPythonFunction } from "../../common/lambda-python.construct";
import { RestApiGateway } from "../rest-api-gateway.construct";
import * as path from "path";

interface ReportsApiConstructProps {
  api: RestApiGateway;
  layer: lambda.LayerVersion;
  reportTable: dynamodb.Table;
}

export class ReportsApiConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ReportsApiConstructProps) {
    super(scope, id);

    // Create reports resource
    const reportsResource = props.api.api.root.addResource("reports");

    // Create lambda function
    const reportsFunction = new LambdaPythonFunction(this, "ReportsFunction", {
      entry: path.join(__dirname, "reports"),
      layer: props.layer,
      environment: {
        REPORT_TABLE_NAME: props.reportTable.tableName,
        REGION: process.env.CDK_DEFAULT_REGION || "us-east-1",
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Grant read access to the DynamoDB table
    props.reportTable.grantReadData(reportsFunction);

    // Add GET method
    reportsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(reportsFunction),
      {
        requestParameters: {
          "method.request.querystring.ticker": false,
          "method.request.querystring.reportDate": false,
        },
        requestValidator: new apigateway.RequestValidator(
          this,
          "ReportsValidator",
          {
            restApi: props.api.api,
            validateRequestParameters: true,
          }
        ),
      }
    );
  }
}
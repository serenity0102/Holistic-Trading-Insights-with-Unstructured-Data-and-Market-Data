import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { LambdaPythonFunction } from "../../common/lambda-python.construct";
import { RestApiGateway } from "../rest-api-gateway.construct";
import * as path from "path";
import { OpenSearchStack } from "../../stacks/opensearch.stack";

interface SearchApiConstructProps {
  api: RestApiGateway;
  layer: lambda.LayerVersion;
  openSearchStack?: OpenSearchStack;
}

export class SearchApiConstruct extends Construct {
  constructor(scope: Construct, id: string, props: SearchApiConstructProps) {
    super(scope, id);

    // Create search resource
    const searchResource = props.api.api.root.addResource("search");

    // Create lambda function
    const searchFunction = new LambdaPythonFunction(this, "SearchFunction", {
      entry: path.join(__dirname, "search"),
      layer: props.layer,
      environment: {
        OPENSEARCH_ENDPOINT: props.openSearchStack?.endpoint
          ? props.openSearchStack.endpoint.replace(/^https?:\/\//, "")
          : "",
        OPENSEARCH_INDEX: "reports",
        REGION: process.env.CDK_DEFAULT_REGION || "us-east-1",
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Add permissions to invoke Bedrock for embeddings
    searchFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:${
            process.env.CDK_DEFAULT_REGION || "us-east-1"
          }::foundation-model/cohere.embed-english-v3`,
        ],
      })
    );

    // Add permissions for OpenSearch
    searchFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["es:ESHttpGet", "es:ESHttpPost", "aoss:APIAccessAll"],
        resources: ["*"],
      })
    );

    // Add GET method with request validation
    searchResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(searchFunction),
      {
        requestParameters: {
          "method.request.querystring.ticker": true,
          "method.request.querystring.reportStart": true,
          "method.request.querystring.reportEnd": true,
          "method.request.querystring.query": true,
        },
        requestValidator: new apigateway.RequestValidator(
          this,
          "SearchValidator",
          {
            restApi: props.api.api,
            validateRequestParameters: true,
          }
        ),
      }
    );
  }
}

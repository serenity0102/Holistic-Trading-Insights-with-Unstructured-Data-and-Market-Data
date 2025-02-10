import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { RestApiGateway } from "../api/rest-api-gateway.construct";
import { getConfig } from "../config/environment";
import { HelloApiConstruct } from "../api/hello/hello.construct";
import { PythonLambdaLayer } from "../common/lambda-layer.construct";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { DynamoDBStack } from "./dynamodb.stack";

export interface ApiStackProps extends NestedStackProps {
  dynamodbStack: DynamoDBStack;
  environment?: string;
}

export class ApiStack extends NestedStack {
  public readonly apiGateway: RestApiGateway;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const config = getConfig(this);

    // Create common Python layer
    const pythonLayer = new PythonLambdaLayer(this, "CommonPythonLayer");

    // Create API Gateway with WAF
    this.apiGateway = new RestApiGateway(this, "RestApiGateway", {
      config: config.apiGateway,
    });

    // Add Hello API
    new HelloApiConstruct(this, "HelloApi", {
      api: this.apiGateway,
      layer: pythonLayer,
      table: props.dynamodbStack.helloWorldTable.table,
    });
  }
}

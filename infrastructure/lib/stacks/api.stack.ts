import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { RestApiGateway } from "../api/rest-api-gateway.construct";
import { getConfig } from "../config/environment";
import { HelloApiConstruct } from "../api/hello/hello.construct";
import { PythonLambdaLayer } from "../common/lambda-layer.construct";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { DynamoDBStack } from "./dynamodb.stack";
import { SearchApiConstruct } from "../api/search/search.construct";
import { ReportsApiConstruct } from "../api/reports/reports.construct";
import { OpenSearchStack } from "./opensearch.stack";

export interface ApiStackProps extends NestedStackProps {
  dynamodbStack: DynamoDBStack;
  openSearchStack?: OpenSearchStack;
  environment: string;
}

export class ApiStack extends NestedStack {
  public readonly apiGateway: RestApiGateway;
  public readonly lambdaLayer: PythonLambdaLayer;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const config = getConfig(this);

    // Create common Python layer
    this.lambdaLayer = new PythonLambdaLayer(this, "CommonPythonLayer");

    // Create API Gateway with WAF
    this.apiGateway = new RestApiGateway(this, "RestApiGateway", {
      config: config.apiGateway,
    });

    // Add Hello API
    new HelloApiConstruct(this, "HelloApi", {
      api: this.apiGateway,
      layer: this.lambdaLayer,
      table: props.dynamodbStack.helloWorldTable.table,
    });

    // Add Search API
    if (props.openSearchStack) {
      new SearchApiConstruct(this, "SearchApi", {
        api: this.apiGateway,
        layer: this.lambdaLayer,
        openSearchStack: props.openSearchStack,
      });
    }
    
    // Add Reports API
    new ReportsApiConstruct(this, "ReportsApi", {
      api: this.apiGateway,
      layer: this.lambdaLayer,
      reportTable: props.dynamodbStack.reportTable.table,
    });
  }
}

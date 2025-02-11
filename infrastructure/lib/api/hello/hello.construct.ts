import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { LambdaPythonFunction } from '../../common/lambda-python.construct';
import { RestApiGateway } from '../rest-api-gateway.construct';
import * as path from 'path';

interface HelloApiConstructProps {
  api: RestApiGateway;
  layer: lambda.LayerVersion;
  table: dynamodb.Table;
}

export class HelloApiConstruct extends Construct {
  constructor(scope: Construct, id: string, props: HelloApiConstructProps) {
    super(scope, id);

    // Create hello resource
    const helloResource = props.api.api.root.addResource('hello');
    const helloWorldResource = helloResource.addResource('hello-world');

    // Create lambda function
    const helloWorldFunction = new LambdaPythonFunction(this, 'HelloWorldFunction', {
      entry: path.join(__dirname, 'hello-world'),
      layer: props.layer,
      environment: {
        HELLO_WORLD_TABLE_NAME: props.table.tableName,
      },
    });

    // Grant DynamoDB permissions
    props.table.grantReadWriteData(helloWorldFunction);

    // Add GET method with request validation
    helloWorldResource.addMethod('GET', 
      new apigateway.LambdaIntegration(helloWorldFunction), {
        requestParameters: {
          'method.request.querystring.id': true, // Make id parameter mandatory
        },
        requestValidator: new apigateway.RequestValidator(this, 'HelloWorldValidator', {
          restApi: props.api.api,
          validateRequestParameters: true,
        }),
      }
    );
  }
} 
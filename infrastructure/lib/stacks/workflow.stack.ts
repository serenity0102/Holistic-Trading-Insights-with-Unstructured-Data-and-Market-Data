import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { DynamoDBStack } from "./dynamodb.stack";
import { StorageStack } from "./storage.stack";
import { PythonLambdaLayer } from "../common/lambda-layer.construct";
import { OcrExtractionWorkflow } from "../workflow/ocr_extraction/_state-machine.construct";

export interface WorkflowStackProps extends cdk.NestedStackProps {
  environment?: string;
  dynamodbStack: DynamoDBStack;
  storageStack: StorageStack;
}

export class WorkflowStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: WorkflowStackProps) {
    super(scope, id, props);

    // Create shared Lambda layer
    const layer = new PythonLambdaLayer(this, "WorkflowLayer");

    // Create OCR extraction workflow
    new OcrExtractionWorkflow(this, "OcrExtractionWorkflow", {
      environment: props.environment,
      dynamodbStack: props.dynamodbStack,
      storageStack: props.storageStack,
      layer: layer,
    });
  }
}

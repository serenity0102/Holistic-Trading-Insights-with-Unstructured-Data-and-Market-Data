import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as pipes from "aws-cdk-lib/aws-pipes";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { PythonLambdaLayer } from "../../common/lambda-layer.construct";
import { LambdaPythonFunction } from "../../common/lambda-python.construct";
import { StandardLambdaInvoke } from "../../common/lambda-invoke.construct";
import { DynamoDBStack } from "../../stacks/dynamodb.stack";
import { StorageStack } from "../../stacks/storage.stack";
import * as path from "path";

/**
 * OCR Extraction Workflow
 *
 * This state machine handles the workflow for OCR extraction from PDF reports.
 * It processes PDF documents page by page and extracts text using OCR.
 *
 * Flow:
 * 1. Process Report PDF - Receives the PDF and prepares it for processing
 * 2. Map (Process Pages) - Processes each page in parallel (max 5 concurrent)
 *    - Extract Page and Save Extraction - Extracts text from page and saves results
 * 3. Aggregate Extractions - Aggregates extracted text from all pages
 * 4. Update Report as Completed - Marks the report processing as complete
 *
 * Expected Input:
 * {
 *   "reportId": "string",        // Unique report identifier
 *   "bucketName": "string",     // S3 bucket containing the PDF
 *   "objectKey": "string"       // S3 key for the PDF file
 * }
 *
 * State Outputs:
 *
 * Process Report PDF:
 * {
 *   "reportId": "string",
 *   "pages": [                  // Array of page information
 *     {
 *       "pageNumber": number,
 *       "tempImagePath": "string"
 *     }
 *   ]
 * }
 *
 * Extract Page and Save Extraction:
 * {
 *   "reportId": "string",
 *   "pageNumber": number,
 *   "extractedText": "string",
 *   "confidence": number
 * }
 *
 * Aggregate Extractions:
 * {
 *   "reportId": "string",
 *   "status": "COMPLETED"
 * }
 *
 * Update Report as Completed:
 * {
 *   "reportId": "string",
 *   "status": "COMPLETED",
 *   "totalPages": number,
 *   "completedAt": "string"     // ISO timestamp
 * }
 */
export interface OcrExtractionWorkflowProps {
  environment?: string;
  dynamodbStack: DynamoDBStack;
  storageStack: StorageStack;
  layer: lambda.LayerVersion;
}

export class OcrExtractionWorkflow extends Construct {
  public readonly stateMachine: sfn.StateMachine;
  private readonly props: OcrExtractionWorkflowProps;
  private readonly layer: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props: OcrExtractionWorkflowProps) {
    super(scope, id);
    this.props = props;
    this.layer = props.layer;

    // Create Lambda functions
    const processReportFunction = this.createProcessReportFunction();
    const extractPageFunction = this.createExtractPageFunction();
    const aggregateExtractionsFunction =
      this.createAggregateExtractionsFunction();
    const updateReportStatusFunction = this.createUpdateReportStatusFunction();

    // Create state machine
    const definition = this.defineStateMachine(
      processReportFunction,
      extractPageFunction,
      aggregateExtractionsFunction,
      updateReportStatusFunction
    );

    // Create the state machine
    this.stateMachine = new sfn.StateMachine(this, "OcrExtractionWorkflow", {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.hours(2),
      tracingEnabled: true,
    });

    // Grant permissions to the Lambda functions
    this.props.dynamodbStack.reportTable.table.grantReadWriteData(
      processReportFunction
    );
    this.props.dynamodbStack.reportTable.table.grantReadWriteData(
      extractPageFunction
    );
    this.props.dynamodbStack.reportTable.table.grantReadWriteData(
      aggregateExtractionsFunction
    );
    this.props.dynamodbStack.reportTable.table.grantReadWriteData(
      updateReportStatusFunction
    );

    // Grant S3 permissions
    this.props.storageStack.reportExtractionsBucket.bucket.grantReadWrite(
      processReportFunction
    );
    this.props.storageStack.reportExtractionsBucket.bucket.grantReadWrite(
      extractPageFunction
    );
    this.props.storageStack.reportExtractionsBucket.bucket.grantRead(
      aggregateExtractionsFunction
    );

    // Create the DynamoDB stream trigger
    this.createTrigger();
  }

  private createProcessReportFunction(): lambda.Function {
    return new LambdaPythonFunction(this, "ProcessReportFunction", {
      entry: path.join(__dirname, "process_report"),
      layer: this.layer,
      environment: {
        POWERTOOLS_SERVICE_NAME: "ocr-extraction-workflow",
        ENVIRONMENT: this.props.environment || "dev",
        REPORT_EXTRACTIONS_BUCKET_NAME:
          this.props.storageStack.reportExtractionsBucket.bucket.bucketName,
      },
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
    });
  }

  private createExtractPageFunction(): lambda.Function {
    const extractPageFunction = new LambdaPythonFunction(
      this,
      "ExtractPageFunction",
      {
        entry: path.join(__dirname, "extract_page"),
        layer: this.layer,
        environment: {
          POWERTOOLS_SERVICE_NAME: "ocr-extraction-workflow",
          ENVIRONMENT: this.props.environment || "dev",
          REPORT_EXTRACTIONS_BUCKET_NAME:
            this.props.storageStack.reportExtractionsBucket.bucket.bucketName,
          REPORT_TABLE_NAME:
            this.props.dynamodbStack.reportTable.table.tableName,
        },
        memorySize: 2048,
        timeout: cdk.Duration.minutes(15),
      }
    );

    // Add Bedrock permissions
    extractPageFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: [
          "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
        ],
      })
    );

    return extractPageFunction;
  }

  private createAggregateExtractionsFunction(): lambda.Function {
    return new LambdaPythonFunction(this, "AggregateExtractionsFunction", {
      entry: path.join(__dirname, "aggregate_extractions"),
      layer: this.layer,
      environment: {
        POWERTOOLS_SERVICE_NAME: "ocr-extraction-workflow",
        ENVIRONMENT: this.props.environment || "dev",
        REPORT_EXTRACTIONS_BUCKET_NAME:
          this.props.storageStack.reportExtractionsBucket.bucket.bucketName,
        REPORT_TABLE_NAME: this.props.dynamodbStack.reportTable.table.tableName,
      },
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
    });
  }

  private createUpdateReportStatusFunction(): lambda.Function {
    return new LambdaPythonFunction(this, "UpdateReportStatusFunction", {
      entry: path.join(__dirname, "update_report_status"),
      layer: this.layer,
      environment: {
        POWERTOOLS_SERVICE_NAME: "ocr-extraction-workflow",
        ENVIRONMENT: this.props.environment || "dev",
        REPORT_TABLE_NAME: this.props.dynamodbStack.reportTable.table.tableName,
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
    });
  }

  private defineStateMachine(
    processReportFunction: lambda.Function,
    extractPageFunction: lambda.Function,
    aggregateExtractionsFunction: lambda.Function,
    updateReportStatusFunction: lambda.Function
  ): sfn.IChainable {
    // Process Report PDF task
    const processReport = new StandardLambdaInvoke(this, "ProcessReportPDF", {
      lambdaFunction: processReportFunction,
      comment: "Process PDF report and prepare pages for extraction",
      payloadResponseOnly: true,
    });

    // Extract Page task (used in Map state)
    const extractPage = new StandardLambdaInvoke(
      this,
      "ExtractPageAndSaveExtraction",
      {
        lambdaFunction: extractPageFunction,
        comment: "Extract text from page using OCR",
        payloadResponseOnly: true,
        timeout: cdk.Duration.minutes(5),
      }
    );

    // Map state for processing pages
    const processPages = new sfn.Map(this, "Map", {
      maxConcurrency: 15,
      itemsPath: sfn.JsonPath.stringAt("$.pages"),
      parameters: {
        "reportId.$": "$.reportId",
        "pageNumber.$": "$$.Map.Item.Value.pageNumber",
        "s3Key.$": "$$.Map.Item.Value.s3Key",
        "totalPages.$": "$$.Map.Item.Value.totalPages",
      },
      resultPath: "$.extractionResults",
    }).iterator(extractPage);

    // Add retry policy to Map state
    processPages.addRetry({
      maxAttempts: 10,
      backoffRate: 2,
      interval: cdk.Duration.seconds(1),
      maxDelay: cdk.Duration.seconds(360),
      jitterStrategy: sfn.JitterType.FULL,
    });

    // Add Aggregate Extractions task
    const aggregateExtractions = new StandardLambdaInvoke(
      this,
      "AggregateExtractions",
      {
        lambdaFunction: aggregateExtractionsFunction,
        comment: "Aggregate extracted text from all pages",
        payloadResponseOnly: true,
        payload: sfn.TaskInput.fromObject({
          "reportId.$": "$.reportId",
          "extractionResults.$": "$.extractionResults",
        }),
      }
    );

    // Update Report Status Success task
    const updateReportSuccess = new StandardLambdaInvoke(
      this,
      "UpdateReportAsCompleted",
      {
        lambdaFunction: updateReportStatusFunction,
        comment: "Mark report processing as completed",
        payloadResponseOnly: true,
        payload: sfn.TaskInput.fromObject({
          "reportId.$": "$.reportId",
          status: "COMPLETED",
        }),
      }
    );

    // Update Report Status Error task
    const updateReportError = new StandardLambdaInvoke(
      this,
      "UpdateReportAsError",
      {
        lambdaFunction: updateReportStatusFunction,
        comment: "Mark report processing as failed",
        payloadResponseOnly: true,
        payload: sfn.TaskInput.fromObject({
          "reportId.$": "$.reportId",
          status: "ERROR",
          "error.$": "$.error",
        }),
      }
    );

    // Add error handling to Map state
    processPages.addCatch(updateReportError, {
      resultPath: "$.error",
    });

    // Chain the workflow
    return processReport
      .next(processPages)
      .next(aggregateExtractions)
      .next(updateReportSuccess);
  }

  /**
   * Creates the EventBridge pipe to trigger the state machine from DynamoDB stream
   * Triggers when a new report is inserted with extraction_status = "New"
   */
  private createTrigger(): void {
    // Create IAM role for the pipe
    const pipeRole = new iam.Role(this, "ReportExtractionPipeRole", {
      assumedBy: new iam.ServicePrincipal("pipes.amazonaws.com"),
    });

    // Grant permissions to read from DynamoDB stream
    this.props.dynamodbStack.reportTable.table.grantStreamRead(pipeRole);

    // Grant permissions to start execution of Step Function
    this.stateMachine.grantStartExecution(pipeRole);

    // Create the pipe
    new pipes.CfnPipe(this, "ReportExtractionPipe", {
      name: `report-extraction-pipe-${this.props.environment || "dev"}`,
      roleArn: pipeRole.roleArn,
      source: this.props.dynamodbStack.reportTable.table.tableStreamArn!,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: "LATEST",
          batchSize: 1,
          maximumBatchingWindowInSeconds: 60,
        },
        filterCriteria: {
          filters: [
            {
              pattern: JSON.stringify({
                dynamodb: {
                  NewImage: {
                    extraction_status: {
                      S: ["New"],
                    },
                  },
                },
                eventName: ["INSERT"],
              }),
            },
          ],
        },
      },
      target: this.stateMachine.stateMachineArn,
      targetParameters: {
        stepFunctionStateMachineParameters: {
          invocationType: "FIRE_AND_FORGET",
        },
        inputTemplate: JSON.stringify({
          reportId: "<$.dynamodb.NewImage.pk.S>#<$.dynamodb.NewImage.sk.S>",
          pdfUrl: "<$.dynamodb.NewImage.pdf_url.S>",
        }),
      },
    });
  }
}

import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";

interface StandardLambdaInvokeProps {
  /**
   * The Lambda function to invoke
   */
  lambdaFunction: lambda.Function;

  /**
   * Comment for the task
   */
  comment?: string;

  /**
   * Whether to return only the payload from the Lambda response
   * @default true
   */
  payloadResponseOnly?: boolean;

  /**
   * Whether to retry on service exceptions
   * @default true
   */
  retryOnServiceExceptions?: boolean;

  /**
   * Task timeout
   * @default 30 seconds
   */
  timeout?: cdk.Duration;

  /**
   * Custom retry configuration
   * If not provided, will use standard retry settings
   */
  customRetry?: sfn.RetryProps;

  /**
   * Custom error catch configuration
   */
  catchProps?: sfn.CatchProps;

  /**
   * Error handling state to transition to when catch occurs
   */
  errorHandlingState?: sfn.IChainable;

  /**
   * Input payload for the Lambda function
   */
  payload?: sfn.TaskInput;

  /**
   * Result path for the Lambda function
   */
  resultPath?: string;
}

/**
 * Standard Lambda Invoke task with consistent retry and error handling
 *
 * Default retry configuration:
 * - 100 maximum attempts
 * - 30 seconds initial interval
 * - 1.1 backoff rate
 * - 6 hours maximum delay
 * - Full jitter
 *
 * Default error handling:
 * - Retries on common Lambda and States errors
 * - Catches all unhandled errors
 */
export class StandardLambdaInvoke extends tasks.LambdaInvoke {
  private retryProps: sfn.RetryProps;

  constructor(scope: Construct, id: string, props: StandardLambdaInvokeProps) {
    super(scope, id, {
      lambdaFunction: props.lambdaFunction,
      comment: props.comment,
      payloadResponseOnly: props.payloadResponseOnly ?? true,
      retryOnServiceExceptions: false,
      timeout: props.timeout ?? cdk.Duration.seconds(30),
      payload: props.payload,
      resultPath: props.resultPath,
    });

    // Initialize standard retry configuration
    this.retryProps = {
      maxAttempts: 100,
      backoffRate: 1.1,
      interval: cdk.Duration.seconds(30),
      maxDelay: cdk.Duration.seconds(21600), // 6 hours
      jitterStrategy: sfn.JitterType.FULL,
      errors: [
        "States.TaskFailed",
        "Lambda.ServiceException",
        "Lambda.AWSLambdaException",
        "Lambda.SdkClientException",
        "Lambda.TooManyRequestsException",
        "Lambda.EC2ThrottledException",
        "Lambda.ProvisionedConcurrencyException",
        "Lambda.ResourceNotFoundException",
        "States.Timeout",
        "States.InternalError",
      ],
    };

    // Apply retry configuration
    this.addRetry(props.customRetry ?? this.retryProps);

    // Add error catch if provided
    if (props.catchProps && props.errorHandlingState) {
      this.addCatch(props.errorHandlingState, props.catchProps);
    }
  }

  /**
   * Add custom error types to retry on
   * @param errors Array of error types to retry on
   */
  public addErrorTypesToRetry(errors: string[]): this {
    this.retryProps.errors?.push(...errors);
    this.addRetry(this.retryProps);
    return this;
  }
}

interface StandardLambdaInvokeWithCallbackProps {
  /**
   * The Lambda function to invoke
   */
  lambdaFunction: lambda.Function;

  /**
   * Comment for the task
   */
  comment?: string;

  /**
   * Task timeout - how long the state machine should wait for the callback
   * This is the maximum time the state can wait for SendTaskSuccess/SendTaskFailure
   * @default 7 days
   * @example cdk.Duration.days(14) for 14 days timeout
   */
  timeout?: cdk.Duration;

  /**
   * Input payload to the Lambda function
   * Must include taskToken field
   */
  payload: { [key: string]: any };

  /**
   * Custom retry configuration
   * If not provided, will use standard retry settings
   */
  customRetry?: sfn.RetryProps;

  /**
   * Custom error catch configuration
   */
  catchProps?: sfn.CatchProps;

  /**
   * Error handling state to transition to when catch occurs
   */
  errorHandlingState?: sfn.IChainable;

  /**
   * Heartbeat timeout - how long the state machine should wait between heartbeats
   * If no heartbeat is received within this time, the task fails with States.Timeout
   * @default 1 day
   * @example cdk.Duration.hours(12) for 12 hours heartbeat timeout
   */
  heartbeatTimeout?: cdk.Duration;
}

/**
 * Standard Lambda Invoke task with task token callback pattern
 *
 * Default configuration:
 * - 7 days task timeout
 * - 1 day heartbeat timeout
 * - Wait for callback integration pattern
 * - Standard retry configuration for Lambda errors
 *
 * Use this for long-running tasks that require external completion
 * through SendTaskSuccess/SendTaskFailure API calls
 */
export class StandardLambdaInvokeWithCallback extends tasks.LambdaInvoke {
  private retryProps: sfn.RetryProps;

  constructor(
    scope: Construct,
    id: string,
    props: StandardLambdaInvokeWithCallbackProps
  ) {
    super(scope, id, {
      lambdaFunction: props.lambdaFunction,
      comment: props.comment,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      payload: sfn.TaskInput.fromObject({
        ...props.payload,
        taskToken: sfn.JsonPath.taskToken,
      }),
      retryOnServiceExceptions: false,
      timeout: props.timeout ?? cdk.Duration.days(7),
      heartbeat: props.heartbeatTimeout ?? cdk.Duration.days(1),
    });

    // Initialize standard retry configuration
    this.retryProps = {
      maxAttempts: 100,
      backoffRate: 1.1,
      interval: cdk.Duration.seconds(30),
      maxDelay: cdk.Duration.seconds(21600), // 6 hours
      jitterStrategy: sfn.JitterType.FULL,
      errors: [
        "States.TaskFailed",
        "Lambda.ServiceException",
        "Lambda.AWSLambdaException",
        "Lambda.SdkClientException",
        "Lambda.TooManyRequestsException",
        "States.Timeout",
        "States.HeartbeatTimeout",
      ],
    };

    // Apply retry configuration
    this.addRetry(props.customRetry ?? this.retryProps);

    // Add error catch if provided
    if (props.catchProps && props.errorHandlingState) {
      this.addCatch(props.errorHandlingState, props.catchProps);
    }
  }

  /**
   * Add custom error types to retry on
   * @param errors Array of error types to retry on
   */
  public addErrorTypesToRetry(errors: string[]): this {
    this.retryProps.errors?.push(...errors);
    this.addRetry(this.retryProps);
    return this;
  }
}

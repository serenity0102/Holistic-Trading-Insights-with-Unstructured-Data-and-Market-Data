import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";

export class ReportExtractionsBucket extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Get environment from CDK context
    const stack = Stack.of(scope);
    const environment = stack.node.tryGetContext("environment");
    const isDevEnvironment = environment === "local" || environment === "dev";

    this.bucket = new s3.Bucket(this, "ReportExtractionsBucket", {
      // Auto delete objects and bucket in dev environments
      removalPolicy: isDevEnvironment
        ? cdk.RemovalPolicy.DESTROY
        : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: isDevEnvironment,

      // Enforce encryption
      encryption: s3.BucketEncryption.S3_MANAGED,

      // Enable versioning
      versioned: true,

      // Configure lifecycle rules for all objects
      lifecycleRules: [
        {
          // Delete all objects after 1 day
          expiration: cdk.Duration.days(1),
        },
      ],

      // Block public access
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
  }
}

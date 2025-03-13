import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";

export interface FrontendStackProps extends NestedStackProps {
  environment: string;
  apiEndpoint?: string;
}

export class FrontendStack extends NestedStack {
  public readonly cloudfrontDistribution: cloudfront.Distribution;
  public readonly websiteBucket: s3.Bucket;
  public readonly cloudfrontUrl: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // Create S3 bucket to host the website
    this.websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.environment === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== "prod",
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      "OriginAccessIdentity",
      {
        comment: `OAI for ${id}`,
      }
    );

    // Grant read access to CloudFront
    this.websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [this.websiteBucket.arnForObjects("*")],
        principals: [
          new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    // Create CloudFront distribution
    this.cloudfrontDistribution = new cloudfront.Distribution(
      this,
      "Distribution",
      {
        defaultRootObject: "index.html",
        defaultBehavior: {
          origin: new origins.S3Origin(this.websiteBucket, {
            originAccessIdentity,
          }),
          compress: true,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
        ],
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      }
    );

    // Deploy website content to S3
    console.log(path.join(__dirname, "../../../frontend/dist"));
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../../frontend/dist")),
      ],
      destinationBucket: this.websiteBucket,
      distribution: this.cloudfrontDistribution,
      distributionPaths: ["/*"],
    });

    // Output the CloudFront URL
    this.cloudfrontUrl = `https://${this.cloudfrontDistribution.distributionDomainName}`;

    // Add CloudFront URL as output
    new cdk.CfnOutput(this, "CloudFrontURL", {
      value: this.cloudfrontUrl,
      description: "The URL of the CloudFront distribution",
      exportName: `${props.environment}-CloudFrontURL`,
    });

    // Add S3 bucket name as output
    new cdk.CfnOutput(this, "WebsiteBucketName", {
      value: this.websiteBucket.bucketName,
      description: "The name of the S3 bucket hosting the website",
      exportName: `${props.environment}-WebsiteBucketName`,
    });
  }
}

#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TradingInsightStack } from "../lib/trading-insight-stack";

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext("environment") || "dev";

// Create main stack in the default region
const mainStack = new TradingInsightStack(app, "TradingInsightStack", {
  description: "Main stack containing API, DynamoDB resources",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

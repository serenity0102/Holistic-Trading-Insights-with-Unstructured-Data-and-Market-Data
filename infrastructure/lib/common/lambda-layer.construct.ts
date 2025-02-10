import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as path from "path";

export class PythonLambdaLayer extends lambda.LayerVersion {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      code: lambda.Code.fromAsset(path.join(__dirname, "../layers/"), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            "bash",
            "-c",
            [
              "pip install -r python/requirements.txt -t /asset-output/python",
              "cp -r python/ddb /asset-output/python/",
              "cp -r python/common /asset-output/python/",
            ].join(" && "),
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: "Common Python dependencies including AWS Lambda Powertools",
    });
  }
}

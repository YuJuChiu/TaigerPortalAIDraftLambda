import * as cdk from "aws-cdk-lib";
import { Code } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { Function, Runtime } from "aws-cdk-lib/aws-lambda";
import path from "path";

interface LambdaStackProps extends cdk.StackProps {
    stageName: string;
}

export class LambdaStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);

        new Function(this, "TaiGerPortalTranscriptAnalyzerLambdaFunction", {
            runtime: Runtime.PYTHON_3_9,
            code: Code.fromAsset(path.join(__dirname, "..", "lambda")), // Use the zip artifact from CodeBuild
            handler: "lambda_function.lambda_handler"
        });
    }
}

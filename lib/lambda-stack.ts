import * as cdk from "aws-cdk-lib";
import { Code, FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { Function, Runtime } from "aws-cdk-lib/aws-lambda";
import path from "path";
import { Effect, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";

interface LambdaStackProps extends cdk.StackProps {
    stageName: string;
}

export class LambdaStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);

        const lambdaFunction = new Function(this, "TaiGerPortalTranscriptAnalyzerLambdaFunction", {
            runtime: Runtime.PYTHON_3_9,
            code: Code.fromAsset(path.join(__dirname, "..", "lambda")), // Use the zip artifact from CodeBuild
            handler: "lambda_function.lambda_handler"
        });

        lambdaFunction.addFunctionUrl({
            authType: FunctionUrlAuthType.AWS_IAM
        });

        // Reference the existing EC2 instance role (replace 'your-ec2-role-name' with the actual role name)
        const ec2InstanceRole = Role.fromRoleName(this, "EC2InstanceRole", "ec2_taiger_test_infra");

        // Add an IAM policy that allows the EC2 role to invoke the Lambda function URL
        lambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["lambda:InvokeFunctionUrl"],
                resources: [lambdaFunction.functionArn],
                principals: [ec2InstanceRole]
            })
        );
    }
}

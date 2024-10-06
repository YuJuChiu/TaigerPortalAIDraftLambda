import * as cdk from "aws-cdk-lib";
import { Code, FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { Function, Runtime } from "aws-cdk-lib/aws-lambda";
import path from "path";
import { Effect, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";
import {
    AuthorizationType,
    LambdaIntegration,
    MethodOptions,
    RestApi
} from "aws-cdk-lib/aws-apigateway";

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

        // Create API Gateway
        const api = new RestApi(this, "MyApi", {
            restApiName: "MyService",
            description: "This service handles requests with Lambda."
        });

        // Lambda integration
        const lambdaIntegration = new LambdaIntegration(lambdaFunction, {
            proxy: true // Proxy all requests to the Lambda
        });

        // Define IAM authorization for the API Gateway method
        const methodOptions: MethodOptions = {
            authorizationType: AuthorizationType.IAM // Require SigV4 signed requests
        };

        // Create a resource and method in API Gateway
        const lambdaResource = api.root.addResource("analyze");
        lambdaResource.addMethod("GET", lambdaIntegration, methodOptions);
    }
}

import * as cdk from "aws-cdk-lib";
import { Code } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { Function, Runtime } from "aws-cdk-lib/aws-lambda";
import path from "path";
import {
    ArnPrincipal,
    CompositePrincipal,
    PolicyStatement,
    Role,
    ServicePrincipal
} from "aws-cdk-lib/aws-iam";
import {
    AuthorizationType,
    LambdaIntegration,
    MethodOptions,
    RestApi
} from "aws-cdk-lib/aws-apigateway";
import { AWS_ACCOUNT } from "../configuration";

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

        // Create API Gateway
        const api = new RestApi(this, "TranscriptAnalyzerAPIG", {
            restApiName: "TranscriptAnalyzer",
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

        // Create an IAM role for the authorized client
        const clientRole = new Role(this, "AuthorizedClientRole", {
            assumedBy: new CompositePrincipal(
                new ServicePrincipal("ec2.amazonaws.com"),
                new ArnPrincipal(`arn:aws:iam::${AWS_ACCOUNT}:role/ec2_taiger_test_infra`)
                // new ArnPrincipal("arn:aws:iam::${AWS_ACCOUNT}:user/specific-iam-user"),
            ),
            description: "Role for authorized clients to access the API"
        });

        // Grant permission to invoke the API
        clientRole.addToPolicy(
            new PolicyStatement({
                actions: ["execute-api:Invoke"],
                resources: [api.arnForExecuteApi()]
            })
        );

        // // Output the role ARN for reference
        // new cdk.CfnOutput(this, "AuthorizedClientRoleArn", {
        //     value: clientRole.roleArn,
        //     description: "ARN of the IAM role for authorized clients"
        // });

        // // Output the API URL
        // new cdk.CfnOutput(this, "ApiUrl", {
        //     value: api.url,
        //     description: "URL of the API Gateway"
        // });
    }
}

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
    BasePathMapping,
    DomainName,
    EndpointType,
    LambdaIntegration,
    MethodOptions,
    RestApi
} from "aws-cdk-lib/aws-apigateway";
import { APP_NAME, AWS_ACCOUNT, DOMAIN_NAME } from "../configuration";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";

interface LambdaStackProps extends cdk.StackProps {
    stageName: string;
    domainStage: string;
}

export class LambdaStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);

        const API_ENDPOINT = `api.${DOMAIN_NAME}`;

        const lambdaFunction = new Function(
            this,
            `TaiGerPortalTranscriptAnalyzerLambdaFunction-${props.stageName}`,
            {
                runtime: Runtime.PYTHON_3_9,
                code: Code.fromAsset(path.join(__dirname, "..", "lambda")), // Use the zip artifact from CodeBuild
                handler: "lambda_function.lambda_handler"
            }
        );

        // Step 1: Create or use an existing ACM certificate in the same region
        // Define the ACM certificate
        // domain name of ACM: *.taigerconsultancy-portal.com
        const certificate = Certificate.fromCertificateArn(
            this,
            "Certificate",
            "arn:aws:acm:us-east-1:669131042313:certificate/44845b4a-61c2-4b9c-8d80-755890a1838e"
        );

        // Step 2: Create API Gateway
        const api = new RestApi(this, `${APP_NAME}-APIG-${props.stageName}`, {
            restApiName: `${APP_NAME}-${props.stageName}`,
            description: "This service handles requests with Lambda.",
            deployOptions: {
                stageName: "prod" // Your API stage
            }
        });

        // Step 3: Map the custom domain name to the API Gateway
        const domainName = new DomainName(this, `${APP_NAME}-CustomDomainName-${props.stageName}`, {
            domainName: API_ENDPOINT, // Your custom domain
            certificate: certificate,
            endpointType: EndpointType.REGIONAL // Or REGIONAL for a regional API
        });

        new BasePathMapping(this, `${APP_NAME}-BaseMapping-${props.stageName}`, {
            domainName: domainName,
            restApi: api
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
        const clientRole = new Role(this, `AuthorizedClientRole-${props.stageName}`, {
            assumedBy: new CompositePrincipal(
                new ServicePrincipal("ec2.amazonaws.com"),
                new ArnPrincipal(`arn:aws:iam::${AWS_ACCOUNT}:role/ec2_taiger_test_infra`),
                new ArnPrincipal(`arn:aws:iam::${AWS_ACCOUNT}:user/taiger_leo`)
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

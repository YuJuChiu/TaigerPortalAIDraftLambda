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
import {
    APP_NAME_TRANSCRIPT_ANALYZER,
    AWS_ACCOUNT,
    DOMAIN_NAME,
    TENANT_NAME
} from "../configuration";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { ApiGatewayDomain } from "aws-cdk-lib/aws-route53-targets";

interface LambdaStackProps extends cdk.StackProps {
    stageName: string;
    domainStage: string;
    isProd: boolean;
}

export class LambdaStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);

        const API_ENDPOINT = `${props.domainStage}.${DOMAIN_NAME}`;

        const lambdaFunction = new Function(
            this,
            `${TENANT_NAME}PortalTranscriptAnalyzerLambdaFunction-${props.stageName}`,
            {
                runtime: Runtime.PYTHON_3_9,
                code: Code.fromAsset(path.join(__dirname, "..", "lambda", "transcript_analyser"), {
                    bundling: {
                        image: Runtime.PYTHON_3_9.bundlingImage,
                        command: [
                            "bash",
                            "-c",
                            "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output"
                        ]
                    }
                }), // Use the zip artifact from CodeBuild
                handler: "lambda_function.lambda_handler"
            }
        );

        // Step 1: Create or use an existing ACM certificate in the same region
        // Define the ACM certificate
        // domain name of ACM: *.taigerconsultancy-portal.com
        // Define the hosted zone for your domain (example.com)
        const hostedZone = HostedZone.fromLookup(
            this,
            `${TENANT_NAME}HostedZone-${props.stageName}`,
            {
                domainName: DOMAIN_NAME
            }
        );

        // Create an ACM certificate
        const certificate = new Certificate(this, `${TENANT_NAME}-Certificate-${props.stageName}`, {
            domainName: API_ENDPOINT, // Replace with your domain
            validation: CertificateValidation.fromDns(hostedZone) // Validate via DNS
        });

        // Step 2: Create API Gateway
        const api = new RestApi(this, `${APP_NAME_TRANSCRIPT_ANALYZER}-APIG-${props.stageName}`, {
            restApiName: `${APP_NAME_TRANSCRIPT_ANALYZER}-${props.stageName}`,
            description: "This service handles requests with Lambda.",
            deployOptions: {
                stageName: "prod" // Your API stage
            }
        });

        // Step 3: Map the custom domain name to the API Gateway
        const domainName = new DomainName(
            this,
            `${APP_NAME_TRANSCRIPT_ANALYZER}-CustomDomainName-${props.stageName}`,
            {
                domainName: API_ENDPOINT, // Your custom domain
                certificate: certificate,
                endpointType: EndpointType.REGIONAL // Or REGIONAL for a regional API
            }
        );

        new BasePathMapping(
            this,
            `${APP_NAME_TRANSCRIPT_ANALYZER}-BaseMapping-${props.stageName}`,
            {
                domainName: domainName,
                restApi: api
            }
        );

        // Add this new section to create an A record for your subdomain
        new ARecord(this, `${APP_NAME_TRANSCRIPT_ANALYZER}-AliasRecord-${props.stageName}`, {
            zone: hostedZone,
            recordName: API_ENDPOINT, // This will create a record for your subdomain
            target: RecordTarget.fromAlias(new ApiGatewayDomain(domainName))
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
        let assumedBy: CompositePrincipal;
        const roleDescription = `Role for authorized clients to access the API in ${props.stageName}`;

        if (props.isProd) {
            assumedBy = new CompositePrincipal(
                new ServicePrincipal("ec2.amazonaws.com"),
                new ArnPrincipal(`arn:aws:iam::${AWS_ACCOUNT}:role/ec2_taiger_test_infra`)
            );
        } else {
            assumedBy = new CompositePrincipal(
                new ArnPrincipal(`arn:aws:iam::${AWS_ACCOUNT}:user/taiger_leo`),
                new ArnPrincipal(`arn:aws:iam::${AWS_ACCOUNT}:user/taiger_alex`),
                new ArnPrincipal(`arn:aws:iam::${AWS_ACCOUNT}:user/taiger_abby`)
            );
        }
        const clientRole = new Role(this, `AuthorizedClientRole-${props.stageName}`, {
            assumedBy,
            description: roleDescription
        });

        // Grant permission to invoke the API
        clientRole.addToPolicy(
            new PolicyStatement({
                actions: ["execute-api:Invoke"],
                resources: [api.arnForExecuteApi()]
            })
        );
    }
}

import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Stack, StackProps, SecretValue } from "aws-cdk-lib";
import { CodeBuildStep, CodePipeline, CodePipelineSource, ShellStep } from "aws-cdk-lib/pipelines";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import { Construct } from "constructs";
import {
    GITHUB_CDK_REPO,
    GITHUB_OWNER,
    GITHUB_PACKAGE_BRANCH,
    GITHUB_REPO,
    GITHUB_TOKEN
} from "../configuration/dependencies";
import { PipelineAppStage } from "./app-stage";
import { STAGES } from "../constants";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Artifact } from "aws-cdk-lib/aws-codepipeline";

export class PipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Define the source for the pipeline
        const source = CodePipelineSource.gitHub(
            `${GITHUB_OWNER}/${GITHUB_REPO}`,
            GITHUB_PACKAGE_BRANCH,
            {
                authentication: SecretValue.secretsManager(GITHUB_TOKEN),
                trigger: codepipeline_actions.GitHubTrigger.WEBHOOK
            }
        );

        // // Building Lambda
        // const lambdaBuildStep = new CodeBuildStep("BuildLambda", {
        //     buildEnvironment: {
        //         buildImage: codebuild.LinuxBuildImage.STANDARD_5_0
        //     },
        //     input: source,
        //     installCommands: [
        //         "pip install -r requirements.txt -t ." // Install dependencies
        //     ],
        //     commands: [
        //         "mkdir -p output", // Create an output directory
        //         "zip -r output/lambda_function.zip lambda" // Zip the Lambda code and dependencies
        //     ],
        //     partialBuildSpec: codebuild.BuildSpec.fromObject({
        //         phases: {
        //             install: {
        //                 "runtime-versions": {
        //                     python: "3.9"
        //                 },
        //                 commands: ["python --version"]
        //             }
        //         }
        //     }),
        //     primaryOutputDirectory: "output" // Output is the current directory
        // });

        // Create the high-level CodePipeline
        const pipeline = new CodePipeline(this, "Pipeline", {
            pipelineName: "TaiGerPortalTranscriptAnalyzerPipeline",
            synth: new ShellStep("Synth", {
                input: source,
                commands: ["npm ci", "npm run build", "npx cdk synth"]
            })
        });

        // // Add a step to build the Python handler
        // const buildPython = new CodeBuildStep("BuildPython", {
        //     input: python_source,
        //     buildEnvironment: {
        //         buildImage: codebuild.LinuxBuildImage.STANDARD_5_0
        //     },
        //     commands: ["pip install -r requirements.txt", "zip -r lambda_function.zip package"],
        //     primaryOutputDirectory: "package"
        // });

        STAGES.forEach(({ stageName, env }) => {
            const stage = new PipelineAppStage(
                this,
                `${stageName}-TaiGerPortalTranscriptAnalyzerLambda`,
                {
                    env,
                    stageName
                }
            );
            pipeline.addStage(stage);
        });
    }
}

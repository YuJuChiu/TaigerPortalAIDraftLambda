import { Construct } from "constructs";
import { LambdaStack } from "./lambda-stack";
import { Stage, StageProps } from "aws-cdk-lib";

interface DeploymentkProps extends StageProps {
    stageName: string;
    domainStage: string;
}

export class PipelineAppStage extends Stage {
    constructor(scope: Construct, id: string, props: DeploymentkProps) {
        super(scope, id, props);

        const lambdaStack = new LambdaStack(this, "LambdaStack", {
            stageName: props.stageName,
            domainStage: props.domainStage
        });
    }
}

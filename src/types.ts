import AWS from 'aws-sdk';
import { createAwsConfig } from './aws/create-aws-config.js';

export class CodePipelineManager {
  private codepipeline: AWS.CodePipeline;

  constructor() {
    const { config, region } = createAwsConfig();
    console.log(`AWS CodePipeline manager initialized with region: ${region}`);
    this.codepipeline = new AWS.CodePipeline(config);
  }

  getCodePipeline(): AWS.CodePipeline {
    return this.codepipeline;
  }
}

// Types for the API responses
export interface PipelineSummary {
  name: string;
  version: number;
  created: string;
  updated: string;
}

export interface TransitionState {
  enabled: boolean;
  lastChangedBy?: string;
  lastChangedAt?: Date | string;
  disabledReason?: string;
}

export interface StageExecution {
  pipelineExecutionId: string;
  status: string;
}

export interface ErrorDetails {
  code: string;
  message: string;
}

export interface ActionExecution {
  status: string;
  summary?: string;
  lastStatusChange: Date | string;
  token?: string;
  externalExecutionId?: string;
  externalExecutionUrl?: string;
  errorDetails?: ErrorDetails;
}

export interface ActionRevision {
  revisionId: string;
  revisionChangeId: string;
  created: Date | string;
}

export interface ActionState {
  actionName: string;
  currentRevision?: ActionRevision;
  latestExecution?: ActionExecution;
  entityUrl?: string;
}

export interface StageState {
  stageName: string;
  inboundTransitionState?: TransitionState;
  actionStates: ActionState[];
  latestExecution?: StageExecution;
}

export interface PipelineState {
  pipelineName: string;
  pipelineVersion: number;
  stageStates: StageState[];
  created: string;
  updated: string;
}

export interface ArtifactRevision {
  name: string;
  revisionId: string;
  revisionChangeIdentifier: string;
  revisionSummary: string;
  created: string;
  revisionUrl: string;
}

export interface PipelineExecution {
  pipelineExecutionId: string;
  status: string;
  artifactRevisions: ArtifactRevision[];
}

export interface ApprovalRequest {
  pipelineName: string;
  stageName: string;
  actionName: string;
  token: string;
}

export interface RetryStageRequest {
  pipelineName: string;
  stageName: string;
  pipelineExecutionId: string;
}

export interface TriggerPipelineRequest {
  pipelineName: string;
}

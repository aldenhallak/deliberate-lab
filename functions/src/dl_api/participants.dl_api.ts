/**
 * API endpoints for participant management (Express version)
 */

import {Response} from 'express';
import createHttpError from 'http-errors';
import {
  DeliberateLabAPIRequest,
  hasDeliberateLabAPIPermission,
  verifyExperimentOwnership,
} from './dl_api.utils';
import {
  ApiKeyType,
  Experiment,
  ParticipantProfileExtended,
  ProfileStageConfig,
  ProfileType,
  StageConfig,
  StageKind,
  createParticipantProfileExtended,
  setProfile,
  VariableScope,
  createChatPromptConfig,
  createAgentChatSettings,
  createDefaultParticipantPrompt,
  DEFAULT_AGENT_PARTICIPANT_CHAT_PROMPT,
} from '@deliberation-lab/utils';
import {app} from '../app';
import {generateVariablesForScope} from '../variables.utils';
import {getFirestoreCohortRef} from '../utils/firestore';

// ************************************************************************* //
// TYPES                                                                     //
// ************************************************************************* //

interface CreateParticipantRequest {
  /** Whether to use anonymous profiles (determined by experiment's profile stage) */
  isAnonymous?: boolean;
  /** Custom name for the participant (overrides auto-generated names) */
  name?: string;
  /** Custom pronouns for the participant */
  pronouns?: string;
  /** Optional agent configuration for AI participants */
  agentConfig?: {
    agentId: string;
    promptContext: string;
    modelSettings: {
      model: string;
    };
    /** Chat settings for AI agents (optional, defaults provided) */
    chatSettings?: {
      /** If true, agent can respond even if their last message was the most recent */
      canSelfTriggerCalls?: boolean;
      /** Max responses the agent can send (-1 for unlimited) */
      maxResponses?: number;
    };
  };
  /** Optional Prolific ID for human participants */
  prolificId?: string;
}

// ************************************************************************* //
// ENDPOINTS                                                                 //
// ************************************************************************* //

/**
 * Create a new participant in a cohort
 */
export async function createParticipant(
  req: DeliberateLabAPIRequest,
  res: Response,
): Promise<void> {
  if (!hasDeliberateLabAPIPermission(req, 'write')) {
    throw createHttpError(403, 'Insufficient permissions');
  }

  const experimentId = req.params.experimentId;
  const cohortId = req.params.cohortId;
  const experimenterId = req.deliberateLabAPIKeyData!.experimenterId;

  if (!experimentId) {
    throw createHttpError(400, 'Experiment ID required');
  }
  if (!cohortId) {
    throw createHttpError(400, 'Cohort ID required');
  }

  // Verify ownership (only creator can add participants)
  await verifyExperimentOwnership(experimentId, experimenterId);

  // Verify cohort exists
  const cohortRef = getFirestoreCohortRef(experimentId, cohortId);
  const cohortDoc = await cohortRef.get();
  if (!cohortDoc.exists) {
    throw createHttpError(404, 'Cohort not found');
  }

  const body = req.body as CreateParticipantRequest;
  const isAnonymous = body.isAnonymous ?? true;

  // Create initial participant config
  const participantConfig = createParticipantProfileExtended({
    currentCohortId: cohortId,
    prolificId: body.prolificId ?? null,
  });

  // Mark participant as connected
  participantConfig.connected = true;

  // If agent config is specified, add to participant config
  if (body.agentConfig) {
    // Transform the simplified API format to internal format
    participantConfig.agentConfig = {
      agentId: body.agentConfig.agentId,
      promptContext: body.agentConfig.promptContext,
      modelSettings: {
        apiType: ApiKeyType.GEMINI_API_KEY,
        modelName: body.agentConfig.modelSettings.model,
      },
    };
  }

  // Define document reference
  const document = app
    .firestore()
    .collection('experiments')
    .doc(experimentId)
    .collection('participants')
    .doc(participantConfig.privateId);

  // Run document write as transaction to ensure consistency
  await app.firestore().runTransaction(async (transaction) => {
    // Confirm that cohort is not locked
    const experiment = (
      await app.firestore().doc(`experiments/${experimentId}`).get()
    ).data() as Experiment;
    if (experiment.cohortLockMap[cohortId]) {
      throw createHttpError(409, 'Cohort is locked');
    }

    // Get participant count for profile assignment
    const numParticipants = (
      await app
        .firestore()
        .collection(`experiments/${experimentId}/participants`)
        .count()
        .get()
    ).data().count;

    // Set participant profile fields
    if (isAnonymous) {
      // Find the profile stage to determine which anonymous profile type to use
      const stages = (
        await app
          .firestore()
          .collection(`experiments/${experimentId}/stages`)
          .get()
      ).docs.map((doc) => doc.data());

      const profileStage = stages.find(
        (stage) => (stage as StageConfig).kind === StageKind.PROFILE,
      ) as ProfileStageConfig | undefined;
      const profileType =
        profileStage?.profileType || ProfileType.ANONYMOUS_ANIMAL;

      setProfile(numParticipants, participantConfig, true, profileType);
    } else {
      setProfile(numParticipants, participantConfig, false);
    }

    // Override with custom name/pronouns if provided
    if (body.name) {
      participantConfig.name = body.name;
    }
    if (body.pronouns) {
      participantConfig.pronouns = body.pronouns;
    }

    // Set current stage ID in participant config
    participantConfig.currentStageId = experiment.stageIds[0];

    // Add variable values at the participant level
    participantConfig.variableMap = await generateVariablesForScope(
      experiment.variableConfigs ?? [],
      {
        scope: VariableScope.PARTICIPANT,
        experimentId: experimentId,
        cohortId: cohortId,
        participantId: participantConfig.privateId,
      },
    );

    // Write new participant document
    transaction.set(document, participantConfig);
  });

  // If agent config is specified, store prompt configs for chat stages
  if (body.agentConfig) {
    // Get all chat stages in this experiment
    const stagesSnapshot = await app
      .firestore()
      .collection(`experiments/${experimentId}/stages`)
      .get();

    const chatStages = stagesSnapshot.docs
      .map((doc) => doc.data() as StageConfig)
      .filter((stage) => stage.kind === StageKind.CHAT);

    // Create prompt config for each chat stage with custom chat settings
    for (const stage of chatStages) {
      const promptConfig = createChatPromptConfig(stage.id, StageKind.CHAT, {
        prompt: createDefaultParticipantPrompt(
          body.agentConfig.promptContext ||
            DEFAULT_AGENT_PARTICIPANT_CHAT_PROMPT,
        ),
        chatSettings: createAgentChatSettings({
          canSelfTriggerCalls:
            body.agentConfig.chatSettings?.canSelfTriggerCalls ?? true, // Default to true for API-created agents
          maxResponses: body.agentConfig.chatSettings?.maxResponses ?? 100,
        }),
      });

      // Store prompt config at experiments/{id}/agentParticipants/{agentId}/prompts/{stageId}
      await app
        .firestore()
        .collection('experiments')
        .doc(experimentId)
        .collection('agentParticipants')
        .doc(body.agentConfig.agentId)
        .collection('prompts')
        .doc(stage.id)
        .set(promptConfig);
    }
  }

  // Return created participant info
  res.status(201).json({
    participant: {
      id: participantConfig.privateId,
      publicId: participantConfig.publicId,
      name: participantConfig.name,
      avatar: participantConfig.avatar,
      isAgent: !!body.agentConfig,
    },
  });
}

/**
 * List participants in a cohort
 */
export async function listParticipants(
  req: DeliberateLabAPIRequest,
  res: Response,
): Promise<void> {
  if (!hasDeliberateLabAPIPermission(req, 'read')) {
    throw createHttpError(403, 'Insufficient permissions');
  }

  const experimentId = req.params.experimentId;
  const cohortId = req.params.cohortId;
  const experimenterId = req.deliberateLabAPIKeyData!.experimenterId;

  if (!experimentId) {
    throw createHttpError(400, 'Experiment ID required');
  }
  if (!cohortId) {
    throw createHttpError(400, 'Cohort ID required');
  }

  // Verify experiment exists and user has access
  const experimentDoc = await app
    .firestore()
    .collection('experiments')
    .doc(experimentId)
    .get();
  if (!experimentDoc.exists) {
    throw createHttpError(404, 'Experiment not found');
  }

  const experiment = experimentDoc.data() as Experiment;
  if (experiment.metadata.creator !== experimenterId) {
    throw createHttpError(403, 'Access denied');
  }

  // Get participants in this cohort
  const snapshot = await app
    .firestore()
    .collection('experiments')
    .doc(experimentId)
    .collection('participants')
    .where('currentCohortId', '==', cohortId)
    .get();

  const participants = snapshot.docs.map((doc) => {
    const data = doc.data() as ParticipantProfileExtended;
    return {
      id: data.privateId,
      publicId: data.publicId,
      name: data.name,
      avatar: data.avatar,
      status: data.currentStatus,
      isAgent: !!data.agentConfig,
    };
  });

  res.status(200).json({
    participants,
    total: participants.length,
  });
}

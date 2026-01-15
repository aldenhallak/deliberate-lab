import {generateId} from '../shared';
import {ChatMessage} from '../chat_message';
import {
  BaseStageConfig,
  BaseStageParticipantAnswer,
  StageKind,
  createStageProgressConfig,
  createStageTextConfig,
} from './stage';

/** Conversation replay stage types and functions. */

// ************************************************************************* //
// TYPES                                                                     //
// ************************************************************************* //

/**
 * ConversationReplayStageConfig.
 *
 * This is saved as a stage doc under experiments/{experimentId}/stages
 */
export interface ConversationReplayStageConfig extends BaseStageConfig {
  kind: StageKind.CONVERSATION_REPLAY;
  messages: ChatMessage[]; // The conversation to display
  autoPlayDelayMs: number; // Delay between messages in ms (0 = manual advance)
  allowReplay: boolean; // Allow participants to restart from beginning
  hideTimestamps: boolean; // Hide original message timestamps
  hideSenderInfo: boolean; // Anonymize sender names/avatars
}

/**
 * ConversationReplayStageParticipantAnswer.
 *
 * This is saved as a stage doc (with stage ID as doc ID) under
 * experiments/{experimentId}/participants/{participantPrivateId}/stageData
 */
export interface ConversationReplayStageParticipantAnswer
  extends BaseStageParticipantAnswer {
  kind: StageKind.CONVERSATION_REPLAY;
  currentMessageIndex: number; // Index of current message being viewed
  isComplete: boolean; // Whether participant has viewed all messages
  replayCount: number; // Number of times participant has replayed
}

// ************************************************************************* //
// FUNCTIONS                                                                 //
// ************************************************************************* //

/** Create conversation replay stage. */
export function createConversationReplayStage(
  config: Partial<ConversationReplayStageConfig> = {},
): ConversationReplayStageConfig {
  return {
    id: config.id ?? generateId(),
    kind: StageKind.CONVERSATION_REPLAY,
    name: config.name ?? 'Conversation Replay',
    descriptions: config.descriptions ?? createStageTextConfig(),
    progress: config.progress ?? createStageProgressConfig(),
    messages: config.messages ?? [],
    autoPlayDelayMs: config.autoPlayDelayMs ?? 0, // default to manual
    allowReplay: config.allowReplay ?? false,
    hideTimestamps: config.hideTimestamps ?? false,
    hideSenderInfo: config.hideSenderInfo ?? false,
  };
}

/** Create conversation replay stage participant answer. */
export function createConversationReplayStageParticipantAnswer(
  config: Partial<ConversationReplayStageParticipantAnswer> = {},
): ConversationReplayStageParticipantAnswer {
  return {
    id: config.id ?? generateId(),
    kind: StageKind.CONVERSATION_REPLAY,
    currentMessageIndex: config.currentMessageIndex ?? 0,
    isComplete: config.isComplete ?? false,
    replayCount: config.replayCount ?? 0,
  };
}

/** Check if participant has completed viewing the conversation. */
export function isConversationReplayComplete(
  answer: ConversationReplayStageParticipantAnswer,
  stage: ConversationReplayStageConfig,
): boolean {
  return answer.currentMessageIndex >= stage.messages.length;
}

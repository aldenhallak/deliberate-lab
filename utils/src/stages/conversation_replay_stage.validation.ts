import {ConversationReplayStageConfig} from './conversation_replay_stage';

/** Conversation replay stage validation types and functions. */

// ************************************************************************* //
// VALIDATION                                                                //
// ************************************************************************* //

/**
 * Validates conversation replay stage configuration.
 * Returns error message if invalid, null if valid.
 */
export function validateConversationReplayStage(
  stage: ConversationReplayStageConfig,
): string | null {
  // Must have at least one message
  if (!stage.messages || stage.messages.length === 0) {
    return 'Conversation must contain at least one message';
  }

  // Auto-play delay must be non-negative
  if (stage.autoPlayDelayMs < 0) {
    return 'Auto-play delay must be non-negative';
  }

  // Validate each message has required fields
  for (let i = 0; i < stage.messages.length; i++) {
    const msg = stage.messages[i];
    if (!msg.id) {
      return `Message ${i + 1} is missing an ID`;
    }
    if (!msg.message && msg.message !== '') {
      return `Message ${i + 1} is missing message content`;
    }
    if (!msg.profile) {
      return `Message ${i + 1} is missing sender profile`;
    }
  }

  return null;
}

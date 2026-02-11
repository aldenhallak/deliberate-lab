import {ParticipantProfileExtended} from '../participant';
import {AgentParticipantStageActions, BaseStageHandler} from './stage.handler';
import {StageConfig, StageParticipantAnswer} from './stage';
import {
  TranscriptRatingStageConfig,
  TranscriptRatingStageParticipantAnswer,
  createTranscriptRatingStageParticipantAnswer,
} from './transcript_rating_stage';

/** Stage handler for Transcript Rating stage. */
export class TranscriptRatingStageHandler extends BaseStageHandler {
  /**
   * Agent participants should call API to generate ratings and then
   * move to the next stage.
   */
  override getAgentParticipantActionsForStage(
    participant: ParticipantProfileExtended,
    stage: StageConfig,
  ): AgentParticipantStageActions {
    return {callApi: true, moveToNextStage: true};
  }

  /**
   * Extract rating data from model response and build participant answer.
   */
  override extractAgentParticipantAnswerFromResponse(
    participant: ParticipantProfileExtended,
    stage: StageConfig,
    response: unknown,
  ): StageParticipantAnswer | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const typedStage = stage as TranscriptRatingStageConfig;
    const responseObj = response as Record<string, unknown>;

    // Try to extract ratings from response
    // Expected format: { ratings: { criterion_type: number, ... } }
    // or { ratingMap: { criterionId: number, ... } }
    const ratingsData =
      (responseObj.ratings as Record<string, number>) ??
      (responseObj.ratingMap as Record<string, number>) ??
      {};

    const ratingMap: Record<string, number> = {};

    // Map ratings by criterion type OR id
    for (const criterion of typedStage.criteria) {
      const ratingByType = ratingsData[criterion.type];
      const ratingById = ratingsData[criterion.id];
      const rating = ratingByType ?? ratingById;

      if (typeof rating === 'number') {
        // Clamp to valid range
        const clampedRating = Math.max(
          criterion.minValue,
          Math.min(criterion.maxValue, Math.round(rating)),
        );
        ratingMap[criterion.id] = clampedRating;
      }
    }

    // Only return answer if we got at least some ratings
    if (Object.keys(ratingMap).length === 0) {
      return undefined;
    }

    return createTranscriptRatingStageParticipantAnswer({
      id: stage.id,
      ratingMap,
      feedbackMap: {},
      submittedAt: Date.now(),
    });
  }
}

import {Type, type Static} from '@sinclair/typebox';
import {StageKind} from './stage';
import {
  StageProgressConfigSchema,
  StageTextConfigSchema,
} from './stage.validation';

/** Shorthand for strict TypeBox object validation */
const strict = {additionalProperties: false} as const;

/** TypeBox schemas for Transcript Rating stage validation. */

/** RubricCriterion input validation. */
export const RubricCriterionData = Type.Object(
  {
    id: Type.String({minLength: 1}),
    property: Type.String(),
    type: Type.String(),
    importance: Type.Union([
      Type.Literal('high'),
      Type.Literal('medium'),
      Type.Literal('low'),
    ]),
    description: Type.String(),
    minValue: Type.Number(),
    maxValue: Type.Number(),
    lowLabel: Type.String(),
    highLabel: Type.String(),
  },
  {$id: 'RubricCriterion', ...strict},
);

/** TranscriptRatingStageConfig input validation. */
export const TranscriptRatingStageConfigData = Type.Object(
  {
    id: Type.String({minLength: 1}),
    kind: Type.Literal(StageKind.TRANSCRIPT_RATING),
    name: Type.String({minLength: 1}),
    descriptions: Type.Ref(StageTextConfigSchema),
    progress: Type.Ref(StageProgressConfigSchema),
    transcript: Type.String(),
    transcriptMessages: Type.Array(Type.Any()), // ChatMessage array
    useStructuredTranscript: Type.Boolean(),
    criteria: Type.Array(RubricCriterionData),
    requireAllRatings: Type.Boolean(),
  },
  {$id: 'TranscriptRatingStageConfig', ...strict},
);

/** TranscriptRatingStageParticipantAnswer input validation. */
export const TranscriptRatingStageParticipantAnswerData = Type.Object(
  {
    id: Type.String({minLength: 1}),
    kind: Type.Literal(StageKind.TRANSCRIPT_RATING),
    ratingMap: Type.Record(Type.String({minLength: 1}), Type.Number()),
    feedbackMap: Type.Record(Type.String({minLength: 1}), Type.String()),
    submittedAt: Type.Union([Type.Number(), Type.Null()]),
  },
  strict,
);

/** Update transcript rating stage endpoint validation. */
export const UpdateTranscriptRatingStageParticipantAnswerData = Type.Object(
  {
    experimentId: Type.String({minLength: 1}),
    cohortId: Type.String({minLength: 1}),
    participantPrivateId: Type.String({minLength: 1}),
    participantPublicId: Type.String({minLength: 1}),
    transcriptRatingStageParticipantAnswer:
      TranscriptRatingStageParticipantAnswerData,
  },
  strict,
);

export type UpdateTranscriptRatingStageParticipantAnswerData = Static<
  typeof UpdateTranscriptRatingStageParticipantAnswerData
>;

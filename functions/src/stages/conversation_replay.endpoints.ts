import {Value} from '@sinclair/typebox/value';
import {UpdateConversationReplayStageParticipantAnswerData} from '@deliberation-lab/utils';

import {onCall, HttpsError} from 'firebase-functions/v2/https';

import {app} from '../app';
import {
  checkConfigDataUnionOnPath,
  isUnionError,
  prettyPrintError,
  prettyPrintErrors,
} from '../utils/validation';

/** Endpoints for updating conversation replay stage participant answers. */

// ************************************************************************* //
// updateConversationReplayStageParticipantAnswer endpoint                   //
//                                                                           //
// Input structure: { experimentId, participantPrivateId,                    //
//                    conversationReplayStageParticipantAnswer }             //
// Validation: utils/src/stages/conversation_replay_stage.validation.ts     //
// ************************************************************************* //

export const updateConversationReplayStageParticipantAnswer = onCall(
  async (request) => {
    const {data} = request;

    // Validate input
    const validInput = Value.Check(
      UpdateConversationReplayStageParticipantAnswerData,
      data,
    );
    if (!validInput) {
      handleUpdateConversationReplayStageParticipantAnswerValidationErrors(
        data,
      );
    }

    // Define document reference
    const document = app
      .firestore()
      .collection('experiments')
      .doc(data.experimentId)
      .collection('participants')
      .doc(data.participantPrivateId)
      .collection('stageData')
      .doc(data.conversationReplayStageParticipantAnswer.id);

    // Run document write as transaction to ensure consistency
    await app.firestore().runTransaction(async (transaction) => {
      transaction.set(document, data.conversationReplayStageParticipantAnswer);
    });

    return {id: document.id};
  },
);

function handleUpdateConversationReplayStageParticipantAnswerValidationErrors(
  data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  for (const error of Value.Errors(
    UpdateConversationReplayStageParticipantAnswerData,
    data,
  )) {
    if (isUnionError(error)) {
      const nested = checkConfigDataUnionOnPath(data, error.path);
      prettyPrintErrors(nested);
    } else {
      prettyPrintError(error);
    }
  }

  throw new HttpsError('invalid-argument', 'Invalid data');
}

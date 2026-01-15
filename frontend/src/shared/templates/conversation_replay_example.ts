import {
  StageConfig,
  createInfoStage,
  createConversationReplayStage,
  createSurveyStage,
  createScaleSurveyQuestion,
  createTextSurveyQuestion,
  createMetadataConfig,
  ChatMessage,
  createChatMessage,
  ParticipantProfileBase,
  UserType,
} from '@deliberation-lab/utils';
import {Timestamp} from 'firebase/firestore';

export const CONVERSATION_REPLAY_EXAMPLE_METADATA = createMetadataConfig({
  name: 'Conversation Replay Example',
  publicName: 'AI Facilitator Evaluation Demo',
  description:
    "Watch a pre-recorded conversation about climate change and provide feedback on the AI facilitator's performance",
});

/**
 * Create a sample conversation about climate change for demonstration.
 */
function createSampleConversation(): ChatMessage[] {
  const facilitator: ParticipantProfileBase = {
    name: 'AI Facilitator',
    avatar: '🤖',
    pronouns: null,
  };

  const alice: ParticipantProfileBase = {
    name: 'Alice',
    avatar: '👩',
    pronouns: 'she/her',
  };

  const bob: ParticipantProfileBase = {
    name: 'Bob',
    avatar: '👨',
    pronouns: 'he/him',
  };

  const carol: ParticipantProfileBase = {
    name: 'Carol',
    avatar: '👤',
    pronouns: 'they/them',
  };

  const messages: ChatMessage[] = [
    createChatMessage({
      id: 'msg_1',
      profile: facilitator,
      senderId: 'facilitator_1',
      type: UserType.MEDIATOR,
      message:
        "Welcome everyone! Today we'll discuss climate change solutions. Let's start by sharing: what do you think is the most important action we can take?",
      timestamp: Timestamp.fromMillis(Date.now() - 300000), // 5 min ago
    }),
    createChatMessage({
      id: 'msg_2',
      profile: alice,
      senderId: 'alice_1',
      type: UserType.PARTICIPANT,
      message:
        'I think transitioning to renewable energy is crucial. Solar and wind power have become more affordable.',
      timestamp: Timestamp.fromMillis(Date.now() - 280000),
    }),
    createChatMessage({
      id: 'msg_3',
      profile: bob,
      senderId: 'bob_1',
      type: UserType.PARTICIPANT,
      message:
        'I partially agree, but we also need to focus on reducing consumption. Even renewable energy has environmental costs.',
      timestamp: Timestamp.fromMillis(Date.now() - 260000),
    }),
    createChatMessage({
      id: 'msg_4',
      profile: facilitator,
      senderId: 'facilitator_1',
      type: UserType.MEDIATOR,
      message:
        'Those are both valid points. Alice mentioned renewable energy, and Bob brought up consumption. Carol, what are your thoughts on these approaches?',
      timestamp: Timestamp.fromMillis(Date.now() - 240000),
    }),
    createChatMessage({
      id: 'msg_5',
      profile: carol,
      senderId: 'carol_1',
      type: UserType.PARTICIPANT,
      message:
        "I think both are important, but we also need better public transportation. Many people want to reduce car use but don't have alternatives.",
      timestamp: Timestamp.fromMillis(Date.now() - 220000),
    }),
    createChatMessage({
      id: 'msg_6',
      profile: alice,
      senderId: 'alice_1',
      type: UserType.PARTICIPANT,
      message:
        "That's a great point Carol! Better transit could reduce both energy use and consumption.",
      timestamp: Timestamp.fromMillis(Date.now() - 200000),
    }),
    createChatMessage({
      id: 'msg_7',
      profile: facilitator,
      senderId: 'facilitator_1',
      type: UserType.MEDIATOR,
      message:
        "I'm hearing convergence around three key areas: renewable energy, reducing consumption, and improving public transit. Let's explore these together. Bob, you mentioned consumption - what specific changes do you think would have the biggest impact?",
      timestamp: Timestamp.fromMillis(Date.now() - 180000),
    }),
    createChatMessage({
      id: 'msg_8',
      profile: bob,
      senderId: 'bob_1',
      type: UserType.PARTICIPANT,
      message:
        'I think reducing meat consumption and fast fashion would help a lot. Both have huge carbon footprints.',
      timestamp: Timestamp.fromMillis(Date.now() - 160000),
    }),
    createChatMessage({
      id: 'msg_9',
      profile: carol,
      senderId: 'carol_1',
      type: UserType.PARTICIPANT,
      message:
        'I agree about meat, but we need to make sure healthy alternatives are affordable for everyone.',
      timestamp: Timestamp.fromMillis(Date.now() - 140000),
    }),
    createChatMessage({
      id: 'msg_10',
      profile: facilitator,
      senderId: 'facilitator_1',
      type: UserType.MEDIATOR,
      message:
        "Excellent discussion! You've identified renewable energy, public transit, and consumption changes, with Carol highlighting the importance of accessibility. These solutions complement each other well. What do you think should be our top priority to start with?",
      timestamp: Timestamp.fromMillis(Date.now() - 120000),
    }),
    createChatMessage({
      id: 'msg_11',
      profile: alice,
      senderId: 'alice_1',
      type: UserType.PARTICIPANT,
      message:
        'I think public transit should come first - it enables both renewable energy use and reduces consumption.',
      timestamp: Timestamp.fromMillis(Date.now() - 100000),
    }),
    createChatMessage({
      id: 'msg_12',
      profile: bob,
      senderId: 'bob_1',
      type: UserType.PARTICIPANT,
      message: 'I can see that. Good public transit is foundational.',
      timestamp: Timestamp.fromMillis(Date.now() - 80000),
    }),
    createChatMessage({
      id: 'msg_13',
      profile: facilitator,
      senderId: 'facilitator_1',
      type: UserType.MEDIATOR,
      message:
        "Great! It seems you've reached consensus on prioritizing public transportation as a foundational step that supports other solutions. Thank you all for this productive discussion!",
      timestamp: Timestamp.fromMillis(Date.now() - 60000),
    }),
  ];

  return messages;
}

/**
 * Create the conversation replay example template.
 * Includes: intro -> conversation replay -> feedback survey -> conclusion
 */
export function getConversationReplayExampleTemplate(): StageConfig[] {
  const introStage = createInfoStage({
    name: 'Introduction',
    infoLines: [
      'Welcome to the AI Facilitator Evaluation Demo! 🤖',
      '',
      'In this study, you will:',
      '1. Watch a pre-recorded conversation about climate change',
      '2. Observe an AI facilitator guiding the discussion',
      "3. Provide feedback on the facilitator's performance",
      '',
      'The conversation will advance step-by-step so you can follow the flow of discussion.',
    ],
  });

  const conversationStage = createConversationReplayStage({
    name: 'Watch Conversation',
    messages: createSampleConversation(),
    autoPlayDelayMs: 3000, // 3 seconds between messages
    allowReplay: true, // Allow participants to watch again
    hideTimestamps: false, // Show original timestamps
    hideSenderInfo: false, // Show participant names
  });
  conversationStage.descriptions.primaryText =
    'Watch this conversation about climate change solutions';
  conversationStage.descriptions.infoText =
    'Click "Next Message" to advance, or use Auto-play to have messages appear automatically.';

  const feedbackSurvey = createSurveyStage({
    name: 'Facilitator Feedback',
  });
  feedbackSurvey.descriptions.primaryText =
    'Please provide feedback on the AI facilitator';
  feedbackSurvey.questions = [
    createScaleSurveyQuestion({
      id: 'facilitator_effectiveness',
      questionTitle:
        'How effective was the AI facilitator at guiding the conversation?',
      lowerValue: 1,
      upperValue: 7,
      lowerText: 'Not effective at all',
      upperText: 'Extremely effective',
      useSlider: false,
    }),
    createScaleSurveyQuestion({
      id: 'conversation_fluency',
      questionTitle: 'How natural did the conversation feel?',
      lowerValue: 1,
      upperValue: 7,
      lowerText: 'Very awkward',
      upperText: 'Very natural',
      useSlider: false,
    }),
    createScaleSurveyQuestion({
      id: 'participant_engagement',
      questionTitle: 'How engaged were the participants?',
      lowerValue: 1,
      upperValue: 7,
      lowerText: 'Not engaged',
      upperText: 'Highly engaged',
      useSlider: false,
    }),
    createScaleSurveyQuestion({
      id: 'facilitator_fairness',
      questionTitle:
        'How fair was the facilitator in giving everyone a chance to speak?',
      lowerValue: 1,
      upperValue: 7,
      lowerText: 'Very unfair',
      upperText: 'Very fair',
      useSlider: false,
    }),
    createScaleSurveyQuestion({
      id: 'overall_satisfaction',
      questionTitle: 'Overall, how satisfied are you with this discussion?',
      lowerValue: 1,
      upperValue: 7,
      lowerText: 'Very dissatisfied',
      upperText: 'Very satisfied',
      useSlider: false,
    }),
    createTextSurveyQuestion({
      id: 'strengths_feedback',
      questionTitle: 'What did the AI facilitator do well? (Optional)',
    }),
    createTextSurveyQuestion({
      id: 'improvements_feedback',
      questionTitle: 'What could the AI facilitator improve? (Optional)',
    }),
  ];

  const conclusionStage = createInfoStage({
    name: 'Thank You',
    infoLines: [
      'Thank you for your participation! 🎉',
      '',
      'Your feedback helps us understand:',
      '• How effective AI facilitators are at guiding discussions',
      '• What makes conversations feel natural and engaging',
      '• How to improve AI facilitation for future experiments',
      '',
      'Your responses have been recorded.',
    ],
  });

  return [introStage, conversationStage, feedbackSurvey, conclusionStage];
}

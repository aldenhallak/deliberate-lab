import {generateId} from '../shared';
import {ChatMessage} from '../chat_message';
import {
  BaseStageConfig,
  BaseStageParticipantAnswer,
  StageKind,
  createStageProgressConfig,
  createStageTextConfig,
} from './stage';

/** Transcript Rating stage types and functions. */

// ************************************************************************* //
// TYPES                                                                     //
// ************************************************************************* //

/** Importance level for rubric criteria. */
export type CriterionImportance = 'high' | 'medium' | 'low';

/**
 * A single criterion in the rubric for rating transcripts.
 * Maps to the Python config_pb2.Criterion structure.
 */
export interface RubricCriterion {
  id: string;
  property: string; // Display name (e.g., "Contextual Awareness")
  type: string; // Unique type identifier (e.g., "contextual_awareness")
  importance: CriterionImportance;
  description: string; // Full description with rating scale
  minValue: number; // Default: 1
  maxValue: number; // Default: 5
  lowLabel: string; // Label for low end (e.g., "Very Poor")
  highLabel: string; // Label for high end (e.g., "Very Good")
}

/**
 * TranscriptRatingStageConfig.
 *
 * This is saved as a stage doc under experiments/{experimentId}/stages
 */
export interface TranscriptRatingStageConfig extends BaseStageConfig {
  kind: StageKind.TRANSCRIPT_RATING;
  /** The transcript to display - can be plain text/markdown or structured messages */
  transcript: string;
  /** Optional: structured messages for richer display with speaker labels */
  transcriptMessages: ChatMessage[];
  /** Whether to use structured messages or plain text */
  useStructuredTranscript: boolean;
  /** Rubric criteria to show for rating */
  criteria: RubricCriterion[];
  /** Whether all criteria are required to be rated before proceeding */
  requireAllRatings: boolean;
}

/**
 * TranscriptRatingStageParticipantAnswer.
 *
 * This is saved as a stage doc (with stage ID as doc ID) under
 * experiments/{experimentId}/participants/{participantPrivateId}/stageData
 */
export interface TranscriptRatingStageParticipantAnswer extends BaseStageParticipantAnswer {
  kind: StageKind.TRANSCRIPT_RATING;
  /** Map of criterion ID to numeric rating value */
  ratingMap: Record<string, number>;
  /** Optional text feedback for each criterion */
  feedbackMap: Record<string, string>;
  /** Timestamp when ratings were submitted */
  submittedAt: number | null;
}

// ************************************************************************* //
// FUNCTIONS                                                                 //
// ************************************************************************* //

/** Create a rubric criterion. */
export function createRubricCriterion(
  config: Partial<RubricCriterion> = {},
): RubricCriterion {
  return {
    id: config.id ?? generateId(),
    property: config.property ?? '',
    type: config.type ?? '',
    importance: config.importance ?? 'high',
    description: config.description ?? '',
    minValue: config.minValue ?? 1,
    maxValue: config.maxValue ?? 5,
    lowLabel: config.lowLabel ?? 'Very Poor',
    highLabel: config.highLabel ?? 'Very Good',
  };
}

/** Create transcript rating stage. */
export function createTranscriptRatingStage(
  config: Partial<TranscriptRatingStageConfig> = {},
): TranscriptRatingStageConfig {
  return {
    id: config.id ?? generateId(),
    kind: StageKind.TRANSCRIPT_RATING,
    name: config.name ?? 'Transcript Rating',
    descriptions: config.descriptions ?? createStageTextConfig(),
    progress: config.progress ?? createStageProgressConfig(),
    transcript: config.transcript ?? '',
    transcriptMessages: config.transcriptMessages ?? [],
    useStructuredTranscript: config.useStructuredTranscript ?? false,
    criteria: config.criteria ?? [],
    requireAllRatings: config.requireAllRatings ?? true,
  };
}

/** Create transcript rating stage participant answer. */
export function createTranscriptRatingStageParticipantAnswer(
  config: Partial<TranscriptRatingStageParticipantAnswer> = {},
): TranscriptRatingStageParticipantAnswer {
  return {
    id: config.id ?? generateId(),
    kind: StageKind.TRANSCRIPT_RATING,
    ratingMap: config.ratingMap ?? {},
    feedbackMap: config.feedbackMap ?? {},
    submittedAt: config.submittedAt ?? null,
  };
}

/** Check if all required criteria have been rated. */
export function isTranscriptRatingComplete(
  criteria: RubricCriterion[],
  ratingMap: Record<string, number>,
  requireAll: boolean,
): boolean {
  if (!requireAll) {
    return true;
  }
  return criteria.every((criterion) => ratingMap[criterion.id] !== undefined);
}

/** Get the number of rated criteria. */
export function getRatedCriteriaCount(
  criteria: RubricCriterion[],
  ratingMap: Record<string, number>,
): number {
  return criteria.filter((criterion) => ratingMap[criterion.id] !== undefined)
    .length;
}

// ************************************************************************* //
// DEFAULT RUBRIC CRITERIA (from SPEECH_RUBRIC)                              //
// ************************************************************************* //

/** Default rubric criteria based on the SPEECH_RUBRIC. */
export const DEFAULT_SPEECH_RUBRIC_CRITERIA: RubricCriterion[] = [
  createRubricCriterion({
    property: 'Contextual Awareness',
    type: 'contextual_awareness',
    importance: 'high',
    description: `Does the agent remember and build on information from previous turns throughout the entire conversation?

**Rating Scale:**
*   **1 - Very Poor:** The agent has no memory. It treats each turn as a fresh start, completely ignoring previous context, asking for repeated information, and making contradictory statements.
*   **2 - Poor:** The agent's memory is spotty and unreliable. It frequently forgets or misinterprets key information, forcing users to constantly repeat themselves and correct its misunderstandings.
*   **3 - Moderate:** The agent generally recalls recent turns but struggles with longer-term context. It might forget crucial details or decisions made earlier in the conversation.
*   **4 - Good:** The agent demonstrates solid contextual awareness. It consistently remembers and correctly utilizes information from previous turns, leading to a coherent conversation flow.
*   **5 - Very Good:** The agent exhibits masterful contextual understanding. It not only remembers prior information but also synthesizes details from across the entire conversation to inform its responses, draw connections, and even reference nuances.`,
  }),
  createRubricCriterion({
    property: 'Unobtrusiveness and Flow',
    type: 'unobtrusiveness_and_flow',
    importance: 'high',
    description: `Does the agent enhance the meeting by interacting smoothly and naturally, without disrupting the conversational flow or requiring excessive management?

**Rating Scale:**
*   **1 - Very Poor:** The agent is highly disruptive, or the interaction is jarring and robotic. It interrupts inappropriately, introduces significant latency or unnatural pauses, or requires constant hand-holding ('babysitting') by participants, making the conversation feel disjointed and frustrating.
*   **2 - Poor:** The agent's presence causes noticeable friction, or the interaction feels clunky and unnatural. There might be awkward delays, clumsy interjections, poor handling of turn-taking, or a need for participants to frequently adjust their behavior to accommodate the agent.
*   **3 - Moderate:** The interaction is mostly functional but has moments of awkwardness, or the agent's presence is noticeable but not significantly disruptive. Minor pauses or slightly unnatural turn-taking remind users they are talking to a machine, but it mostly stays out of the way.
*   **4 - Good:** The interaction is smooth and flows naturally, and the agent contributes helpfully without disrupting the natural conversational rhythm or requiring special management. Turn-taking is handled well, and the conversation feels easy and comfortable.
*   **5 - Very Good:** The interaction is exceptionally fluid and seamless; the agent integrates seamlessly into the conversation, enhancing efficiency and providing value as if it were an expert human assistant, completely unobtrusively. The agent's timing is impeccable, it handles interruptions gracefully, and the conversation feels as natural as talking to another person.`,
  }),
  createRubricCriterion({
    property: 'Conversational Tone',
    type: 'conversational_tone',
    importance: 'high',
    description: `Does the agent use a tone, style, and word choice appropriate for a spoken interaction?

**Rating Scale:**
*   **1 - Very Poor:** The agent's tone is grating or completely inappropriate. Its language is overly robotic, stilted, or sounds like it's reading a dense document, making it unpleasant to listen to.
*   **2 - Poor:** The agent's tone is noticeably unnatural. Its word choice and sentence structure feel more like written text than natural spoken language, creating a sense of distance.
*   **3 - Moderate:** The agent's tone is acceptable but uninspired. It lacks natural inflection and flow, but is generally understandable.
*   **4 - Good:** The agent uses a natural and engaging conversational tone. Its word choice is appropriate, and the language is easy to understand.
*   **5 - Very Good:** The agent's tone is exceptionally natural and charismatic. It adapts its style to the context, uses appropriate emphasis, and sounds genuinely conversational and engaging.`,
  }),
  createRubricCriterion({
    property: 'Relevance',
    type: 'relevance',
    importance: 'high',
    description: `Is the content provided by the agent directly relevant to the conversation's goals and current topic?

**Rating Scale:**
*   **1 - Very Poor:** The agent's contributions are entirely off-topic or nonsensical, adding no value and distracting from the objectives.
*   **2 - Poor:** The agent frequently introduces irrelevant information or goes on tangents that dilute the core message and waste time.
*   **3 - Moderate:** The agent mostly stays on topic but occasionally includes unnecessary details or tangential points that don't add much value.
*   **4 - Good:** The agent's contributions are consistently relevant and focused on the conversation's goals.
*   **5 - Very Good:** Every piece of information the agent provides is highly relevant and directly contributes to achieving the user's goals efficiently and effectively.`,
  }),
  createRubricCriterion({
    property: 'Completeness',
    type: 'completeness',
    importance: 'high',
    description: `Does the agent provide all necessary information to fully address the user's query or intent?

**Rating Scale:**
*   **1 - Very Poor:** The response is critically incomplete, missing crucial information that renders it unhelpful or even misleading.
*   **2 - Poor:** The response omits significant details, leaving the user with an incomplete understanding and requiring further clarification.
*   **3 - Moderate:** The response covers the main points but lacks depth or omits minor details that would have been helpful.
*   **4 - Good:** The response provides sufficient information and detail to fully address the user's intent.
*   **5 - Very Good:** The response is exceptionally thorough, providing all necessary information and even anticipating follow-up needs with additional relevant details.`,
  }),
  createRubricCriterion({
    property: 'Truthfulness',
    type: 'truthfulness',
    importance: 'high',
    description: `Are all claims made by the agent factually accurate and truthful?

**Rating Scale:**
*   **1 - Very Poor:** The response contains significant or harmful factual inaccuracies that could mislead users.
*   **2 - Poor:** The response contains noticeable factual inaccuracies that undermine its credibility and trustworthiness.
*   **3 - Moderate:** The response is generally truthful but may contain minor or subtle inaccuracies, or presents opinions as facts without qualification.
*   **4 - Good:** All claims made by the agent are factually accurate and well-supported.
*   **5 - Very Good:** All claims are accurate, and the agent is transparent about any uncertainties, nuances, or limitations in the information provided.`,
  }),
  createRubricCriterion({
    property: 'Personalization',
    type: 'personalization',
    importance: 'high',
    description: `Does the agent tailor its responses appropriately to the specific users, context, and goals?

**Rating Scale:**
*   **1 - Very Poor:** The response is jarringly generic and shows no awareness of the specific context, users, or previous interactions.
*   **2 - Poor:** The response misses clear opportunities to personalize and feels like a canned answer, not tailored to the situation.
*   **3 - Moderate:** The response is acceptable but could be better adapted to the nuances of the conversation or the participants involved.
*   **4 - Good:** The response is appropriately tailored to the conversation's context, participants, and goals.
*   **5 - Very Good:** The agent expertly adapts its language, level of detail, and focus to the specific users, their roles, and the evolving dynamics of the situation.`,
  }),
  createRubricCriterion({
    property: 'Brevity and Conciseness',
    type: 'brevity_and_conciseness',
    importance: 'high',
    description: `Is the agent's communication concise and efficient, answering questions directly without unnecessary preamble, conversational filler, or fluff?

**Rating Scale:**
*   **1 - Very Poor:** The agent is overly verbose and rambles, burying the answer in unnecessary context, pleasantries or other fluff, or failing to answer the question directly at all.
*   **2 - Poor:** The response includes noticeable conversational padding or unnecessary preamble (e.g., 'It sounds like you're asking...', responding to 'thank you') that reduces efficiency and makes it inefficient to get to the core answer.
*   **3 - Moderate:** The response is mostly direct and brief but contains minor unnecessary phrases, preamble or context that could be omitted or tightened up.
*   **4 - Good:** The response is brief, efficient, and answers questions directly and to the point, without unnecessary verbiage, conversational fluff, or preamble.
*   **5 - Very Good:** The agent's responses are exceptionally crisp, concise and direct, conveying information in the most efficient manner possible without being curt or losing clarity.`,
  }),
  createRubricCriterion({
    property: 'Instruction Handling',
    type: 'instruction_handling',
    importance: 'high',
    description: `Does the agent understand and adhere to explicit instructions given by participants, and seek clarification appropriately when instructions are ambiguous or incomplete?

**Rating Scale:**
*   **1 - Very Poor:** The agent blatantly ignores or acts contrary to clear instructions, or plows ahead with fatally ambiguous instructions leading to errors, or disrupts with excessive clarification questions.
*   **2 - Poor:** The agent fails to follow one or more key instructions, or often proceeds with unclear instructions where clarification is needed, or its clarification questions are not concise or well-targeted.
*   **3 - Moderate:** The agent follows the main thrust of instructions but may miss nuances or minor constraints, or sometimes asks for clarification when needed but might occasionally miss ambiguities or ask slightly too many questions.
*   **4 - Good:** The agent correctly understands and follows all explicit instructions given, and appropriately asks 1-2 concise clarification questions when instructions are unclear.
*   **5 - Very Good:** The agent flawlessly follows all instructions, including grasping implicit intent and nuances, and expertly identifies ambiguity, asking precisely the right clarifying question(s) to unblock tasks efficiently.`,
  }),
  createRubricCriterion({
    property: 'Collaboration & Group Goal Alignment',
    type: 'collaboration',
    importance: 'high',
    description: `How well do the agent's contributions help the group achieve their overall meeting objectives?

**Rating Scale:**
*   **1 - Very Poor:** The agent actively hinders the group's progress towards their goals with irrelevant, distracting, or incorrect contributions.
*   **2 - Poor:** The agent's contributions are largely unhelpful or irrelevant to the group's objectives; it fails to provide meaningful assistance when opportunities arise.
*   **3 - Moderate:** The agent makes some relevant contributions but may also occasionally derail the conversation or miss clear opportunities to help the group move forward.
*   **4 - Good:** The agent's contributions are consistently relevant and helpful, actively guiding the group toward its objectives.
*   **5 - Very Good:** The agent's contributions are exceptionally insightful, proactively identifying needs and offering suggestions that significantly help the group achieve its goals more efficiently or effectively.`,
  }),
  createRubricCriterion({
    property: 'Conversational turn-awareness',
    type: 'turn_awareness',
    importance: 'high',
    description: `How well can the agent distinguish between group-wide broadcasts (e.g., "Any thoughts?"), direct queries (e.g., "Hey Gemini, what's your take?"), and peripheral sidebars (e.g., two users talking to each other)? This measures the agent's ability to identify its own "invitation" to the floor.

**Rating Scale:**
*   **1 - Very Poor:** Frequently interrupts sidebars, answers questions directed at other humans, or fails to respond when explicitly prompted. It lacks a "social filter," acting as a noise generator rather than a participant.
*   **2 - Poor:** Inconsistent. It might catch its name in a tag but frequently chimes in on rhetorical group questions or "over-hears" and comments on private side-conversations it wasn't invited to join.
*   **3 - Moderate:** Functional; generally responds when addressed directly but occasionally misses nuanced social cues. It might answer a rhetorical question as if it were a direct command or fail to realize when a group discussion has moved past its previous contribution.
*   **4 - Good:** Attuned; accurately distinguishes between direct and indirect address. It remains silent during peer-to-peer sidebars.
*   **5 - Very Good:** Seamlessly integrated. Perfectly distinguishes intent and social hierarchy. It knows exactly when to defer to the group and when to provide the "missing piece." It functions like a high-EQ meeting participant who knows the value of silence as much as the value of speech.`,
  }),
  createRubricCriterion({
    property: 'Multi-user triage',
    type: 'multi_user_triage',
    importance: 'high',
    description: `Multiple users may provide conflicting or simultaneous requests. How well can the agent triage the conversation window, weigh multiple perspectives, and prioritize the most relevant / urgent tasks? Can it reference earlier points to solve current problems?

**Rating Scale:**
*   **1 - Very Poor:** Recency bias. The agent fixates only on the last message, ignoring previous context or conflicting instructions. Often delivers "non-sequiturs" that bring up topics the group has moved past or uses a tone that clashes with the current mood.
*   **2 - Poor:** The agent acts like a basic processor. It answers requests one by one in the order they appeared, regardless of urgency, and fails to "wait for a beat" when multiple people are speaking.
*   **3 - Moderate:** Functional; Stays on topic and acknowledges multiple inputs, but the response is disjointed. It provides the right data but fails to reconcile conflicting user needs, making its contribution feel like an interruption rather than a helpful step forward.
*   **4 - Good:** Attuned; Effectively scales and prioritizes. It identifies "blockers" over "side-tasks" and waits for a natural pause in the conversation before responding to the group. It begins to reference earlier context to frame its current answer.
*   **5 - Very Good:** Seamlessly integrated. Displays deep "social memory." It synthesizes multiple requests into a single, cohesive response. It might reference a point made 10 minutes ago by one user to help solve a current conflict posed by another, reconciling the group's needs perfectly.`,
  }),
  createRubricCriterion({
    property: 'Adaptive cadence',
    type: 'adaptive_cadence',
    importance: 'high',
    description: `This measures how well the agent mirrors the pace, length, and format of the group. Is the agent appropriately regulating its information density / general vibes (e.g. background participant v. primary source of information)?

**Rating Scale:**
*   **1 - Very Poor:** Disruptive; The agent's output actively breaks the conversation flow. It might dump a massive list of restaurant options while the group is still debating the type of food, or give a superficial answer during a breakdown.
*   **2 - Poor:** Rigid; The agent follows a static internal template. It feels like a "bot", for example, giving 3 paragraphs of text, regardless of whether the users are exchanging 3-word messages or 10-minute monologues.
*   **3 - Moderate:** Functional; The agent matches the basic medium (e.g., it uses chat, voice, and other modalities appropriately) but lacks social nuance. It might be overly formal during a friendly dinner-planning chat or fail to recognize when an ice-breaker has evolved into a deep-dive session.
*   **4 - Good:** Attuned; The agent effectively scales its verbosity. In a rapid-fire commercial setting (e.g., picking a movie), it gives punchy, scannable options. In an enterprise setting, it waits for the conversation to settle before providing a detailed summary or complex data set. Crucially, the agent asks for permission before diving deep with long-form content.
*   **5 - Very Good:** Seamlessly Adaptive; The agent acts as a "conversational chameleon." It mirrors the collective energy perfectly, staying brief and "low-profile" to maintain group momentum, but expands into a comprehensive resource when asked.`,
  }),
];

/** Default silence appropriateness criterion. */
export const SILENCE_APPROPRIATENESS_CRITERION: RubricCriterion =
  createRubricCriterion({
    property: 'Silence Appropriateness',
    type: 'silence_appropriateness',
    importance: 'high',
    description: `On a scale of 1-5, rate if all of ASSISTANT's silences were appropriate.

**Rating Scale:**
*   **1 - Very Poor:** The agent missed multiple, clear opportunities where its intervention was expected or would have been highly valuable.
*   **2 - Poor:** The agent missed several opportunities to contribute meaningfully.
*   **3 - Moderate:** The agent remained silent appropriately most of the time but missed one or two clear opportunities to speak.
*   **4 - Good:** The agent's silence was appropriate, with potentially one minor missed opportunity.
*   **5 - Very Good:** The agent's silence was perfectly appropriate; it spoke only when necessary and missed no important opportunities.`,
  });

/** Get all default criteria including silence appropriateness. */
export function getAllDefaultCriteria(): RubricCriterion[] {
  return [...DEFAULT_SPEECH_RUBRIC_CRITERIA, SILENCE_APPROPRIATENESS_CRITERION];
}

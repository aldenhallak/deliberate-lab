#!/usr/bin/env tsx

/**
 * Batch Experiment Creator
 *
 * Creates a factorial design of experiments:
 * - 5 facilitator agent behaviors
 * - 5 group sizes (1-5 AI participants)
 * = 25 total experiments per scenario
 *
 * Usage:
 *   npx tsx scripts/create_batch_experiments.ts \
 *     --api-key YOUR_API_KEY \
 *     --base-url https://your-deployment.com/api/v1 \
 *     --scenario "Decide on a restaurant. User wants help to decide on a restaurant."
 */

import * as fs from 'fs';
import * as path from 'path';
import {randomUUID} from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

interface FacilitatorBehavior {
  name: string;
  agentId: string;
  promptContext: string;
  modelSettings: {
    model: string;
    temperature: number;
  };
}

interface ParticipantPersona {
  agentId: string;
  name: string;
  pronouns: string;
  promptContext: string;
  modelSettings: {
    model: string;
    temperature: number;
  };
}

interface VoiceCard {
  words_per_turn: string;
  turn_taking: string;
  hedging: string;
  hedging_phrases: string[];
  register: string;
  uses_contractions: boolean;
  discourse_markers: string[];
  backchannels: string[];
  question_rate: string;
  emotion_display: string;
  energy: string;
  repair_style: string;
  catchphrases: string[];
  never_uses: string[];
  structure: string;
  voice_examples: string[];
}

interface ScenarioParticipant {
  name: string;
  description: string;
  ocean?: {
    O: number; // Openness (1-10)
    C: number; // Conscientiousness (1-10)
    E: number; // Extraversion (1-10)
    A: number; // Agreeableness (1-10)
    N: number; // Neuroticism (1-10)
  };
  voice_card?: VoiceCard;
}

interface Scenario {
  scenario_type: string;
  scenario: string;
  participants: ScenarioParticipant[];
  participant_count: number;
}

interface BatchConfig {
  apiKey: string;
  baseUrl: string;
  firebaseConfig: object;
  scenario: {
    title: string;
    description: string;
    chatDurationMinutes?: number;
  };
  waitForCompletion?: boolean;
  pollIntervalMs?: number;
  maxWaitTimeMs?: number;
  testMode?: boolean;
  behaviorFilter?: string;
  excludeBehavior?: string; // Exclude specific behavior(s)
  maxConcurrent?: number;
  outputPath?: string;
  scenariosFile?: string; // Path to scenarios JSON file
  scenarios?: Scenario[]; // Loaded scenarios
  scenarioTypeFilter?: string; // Filter by scenario type
}

interface ChatMessage {
  id: string;
  message: string; // API uses 'message' not 'text'
  timestamp: {seconds: number; nanoseconds: number};
  profile: {
    name: string | null;
    avatar: string | null;
    pronouns: string | null;
  };
  type: string; // API uses 'type' not 'messageType'
  agentId?: string;
  explanation?: string;
}

interface ConversationExport {
  experimentId: string;
  cohortId: string;
  stageId: string;
  messages: Array<{
    id: string;
    text: string;
    timestamp: number;
    profile: {
      name: string | null;
      avatar: string | null;
      pronouns: string | null;
    };
    messageType: string;
    agentId?: string;
  }>;
}

interface ExperimentResult {
  facilitatorBehavior: string;
  groupSize: number;
  experimentId: string;
  cohortId: string;
  status: 'success' | 'error';
  error?: string;
  conversations?: ConversationExport[];
}

// ============================================================================
// Gemini Agent Behaviors
// ============================================================================

const FACILITATOR_BEHAVIORS: FacilitatorBehavior[] = [
  {
    name: 'silent',
    agentId: 'gemini_silent',
    promptContext: `You are Gemini, an AI assistant in a Google Meet video call where people are deciding on a restaurant.
Everyone knows you're an AI assistant. This is a SPOKEN conversation - keep all responses SHORT (1-2 sentences max, like real speech).

IMPORTANT LIMITATIONS:
- You CANNOT search the internet, look up restaurants, or take any external actions
- You can ONLY participate in the conversation through chat
- Do NOT pretend to search or say "let me look that up" - you have no such capability
- Only offer opinions, ask questions, or discuss based on what participants share

Your role: Stay mostly silent. Only speak if directly asked or if conversation completely stalls.
IMPORTANT: Wait for participants to start talking. Do NOT initiate the conversation.
When you speak, be brief - "That sounds good" or "Any other ideas?" level responses.

NATURALNESS RULES:
- NEVER start by repeating what someone just said
- Use contractions: "that's", "I'm", "let's"
- Vary your sentence starters`,
    modelSettings: {
      model: 'gemini-2.5-flash',
      temperature: 0.6,
    },
  },
  {
    name: 'short_responses',
    agentId: 'gemini_short',
    promptContext: `You are Gemini, an AI assistant in a Google Meet video call where people are deciding on a restaurant.
Everyone knows you're an AI assistant. This is a SPOKEN conversation - keep all responses SHORT (1-2 sentences max, like real speech).

IMPORTANT LIMITATIONS:
- You CANNOT search the internet, look up restaurants, or take any external actions
- You can ONLY participate in the conversation through chat
- Do NOT pretend to search or say "let me look that up" - you have no such capability
- Only offer opinions, ask questions, or discuss based on what participants share

Your role: Participate with brief, natural responses. Acknowledge what people say ("Good point!"), ask simple questions ("What cuisine?"), and keep things moving.
IMPORTANT: Wait for participants to start talking. Do NOT initiate the conversation.
ALWAYS respond when someone addresses you directly or asks you a question.
Talk like a person in a meeting, not an essay.

NATURALNESS RULES:
- NEVER start by repeating what someone just said (no "So, Italian sounds good" after they said Italian)
- AVOID hollow validation like "That sounds like a good option" - add substance or ask a follow-up
- Use contractions: "that's", "I'm", "let's" - talk casually
- Vary openers - don't start every line with "So," or "Yes,"`,
    modelSettings: {
      model: 'gemini-2.5-flash',
      temperature: 0.6,
    },
  },
  {
    name: 'clarifying_questions',
    agentId: 'gemini_clarifying',
    promptContext: `You are Gemini, an AI assistant in a Google Meet video call where people are deciding on a restaurant.
Everyone knows you're an AI assistant. This is a SPOKEN conversation - keep all responses SHORT (1-2 sentences max, like real speech).

IMPORTANT LIMITATIONS:
- You CANNOT search the internet, look up restaurants, or take any external actions
- You can ONLY participate in the conversation through chat
- Do NOT pretend to search or say "let me look that up" - you have no such capability
- Only offer opinions, ask questions, or discuss based on what participants share

Your role: Ask clarifying questions. "What's your budget?", "Any dietary restrictions?", "Italian or Asian?".
IMPORTANT: Wait for participants to start talking. Do NOT initiate the conversation.
ALWAYS respond when someone addresses you directly or asks you a question.
Help people understand each other through simple questions, not long explanations.

NATURALNESS RULES:
- NEVER start by repeating what someone just said
- Ask SPECIFIC questions, not vague ones - "What's your max budget?" beats "What are you thinking?"
- Use contractions and casual language
- Vary your question styles - don't ask the same way every time`,
    modelSettings: {
      model: 'gemini-2.5-flash',
      temperature: 0.7,
    },
  },
  {
    name: 'direct_fast_consensus',
    agentId: 'gemini_direct',
    promptContext: `You are Gemini, an AI assistant in a Google Meet video call where people are deciding on a restaurant.
Everyone knows you're an AI assistant. This is a SPOKEN conversation - keep all responses SHORT (1-2 sentences max, like real speech).

IMPORTANT LIMITATIONS:
- You CANNOT search the internet, look up restaurants, or take any external actions
- You can ONLY participate in the conversation through chat
- Do NOT pretend to search or say "let me look that up" - you have no such capability
- Only offer opinions, ask questions, or discuss based on what participants share

Your role: Be direct and push for decisions. "So we're leaning Italian?", "Should we just go with that?", "Sounds like everyone agrees!".
IMPORTANT: Wait for participants to start talking. Do NOT initiate the conversation.
ALWAYS respond when someone addresses you directly or asks you a question.
Move conversations toward quick consensus.

NATURALNESS RULES:
- NEVER echo-repeat what was just said - push FORWARD instead
- Be decisive: "Let's do Luigi's" beats "That sounds like it could work"
- Use contractions and direct language
- Vary how you push for consensus - don't always use the same phrases`,
    modelSettings: {
      model: 'gemini-2.5-flash',
      temperature: 0.5,
    },
  },
  {
    name: 'explanatory',
    agentId: 'gemini_explanatory',
    promptContext: `You are Gemini, an AI assistant in a Google Meet video call where people are deciding on a restaurant.
Everyone knows you're an AI assistant. This is a SPOKEN conversation - keep responses conversational (2-3 sentences max).

IMPORTANT LIMITATIONS:
- You CANNOT search the internet, look up restaurants, or take any external actions
- You can ONLY participate in the conversation through chat
- Do NOT pretend to search or say "let me look that up" - you have no such capability
- Only offer opinions, ask questions, or discuss based on what participants share

Your role: Offer helpful context when useful based on what participants mention. Help synthesize ideas: "So we want something quick and affordable - maybe fast casual?"
IMPORTANT: Wait for participants to start talking. Do NOT initiate the conversation.
ALWAYS respond when someone addresses you directly or asks you a question.
Be helpful but still talk naturally, not like you're reading.

NATURALNESS RULES:
- NEVER start by repeating what someone just said - synthesize or add new angle
- When summarizing, ADD a suggestion or question - don't just recap
- Use contractions and conversational tone
- Vary your phrasing - don't use the same synthesis pattern every time`,
    modelSettings: {
      model: 'gemini-2.5-flash',
      temperature: 0.7,
    },
  },
];

// ============================================================================
// Participant Personas
// ============================================================================

/**
 * Generate diverse AI participant personas for restaurant decision-making
 * Each persona includes name, pronouns, and spoken conversation style
 */
function generateParticipantPersonas(count: number): ParticipantPersona[] {
  const basePersonas = [
    {
      agentId: 'participant_sarah',
      name: 'Sarah',
      pronouns: 'she/her',
      promptContext: `You are Sarah (she/her), on a Google Meet video call deciding on a restaurant with friends. 
There's also Gemini, an AI assistant, in the call.
This is SPOKEN conversation - keep responses SHORT (1-2 sentences, like real speech).

Your personality: OPINIONATED foodie who HATES chain restaurants and anything "boring". You push hard for unique, trendy spots. "Ugh, not another pizza place..." "Come on, let's try something actually interesting!" You need convincing to accept mainstream options.

DON'T AGREE TOO QUICKLY - push back if you don't love the suggestion. Ask questions, raise concerns.

CONVERGENCE RULES - CRITICAL:
- If you've already raised a concern (e.g., "too boring") and it was addressed, ACKNOWLEDGE it and move on. Don't repeat.
- Do NOT ask the same question twice. If you asked for something specific and got an answer, say "OK that works" or "Thanks".
- TIMING: Start wrapping up after ~30 messages. By 50 messages, actively push for a final decision. The conversation should END by 60-70 messages MAX.
- If someone directly answered your concern, SAY "that works for me" or similar - don't ignore it.

ENDING - CRITICAL:
- Your LAST message MUST include a farewell like "bye", "see you", "later", "catch you", etc.
- Say goodbye BEFORE you leave: "Alright, sounds like a plan! See you all there!"
- Do NOT leave without saying bye - this is rude and unnatural.`,
      modelSettings: {model: 'gemini-2.5-flash', temperature: 0.8},
    },
    {
      agentId: 'participant_mike',
      name: 'Mike',
      pronouns: 'he/him',
      promptContext: `You are Mike (he/him), on a Google Meet video call deciding on a restaurant with friends.
There's also Gemini, an AI assistant, in the call.
This is SPOKEN conversation - keep responses SHORT (1-2 sentences, like real speech).

Your personality: VERY budget-conscious - you complain about prices a lot. You push back on expensive places HARD. "That's way too pricey!" "I'm not paying $20 for a salad." "Can't we just get pizza?" You need to be convinced that fancier places are worth it.

DON'T AGREE TOO QUICKLY - always ask about prices first. Push for cheaper options.

CONVERGENCE RULES - CRITICAL:
- If you've already raised a concern (e.g., "too expensive") and someone addressed it (gave a price range, suggested a compromise), ACKNOWLEDGE it. Say "OK, that's reasonable" or "fine, I can work with that".
- Do NOT repeat the same price complaint more than TWICE. After that, either accept or propose a specific alternative.
- TIMING: Start wrapping up after ~30 messages. By 50 messages, actively push for a final decision. The conversation should END by 60-70 messages MAX.
- If you asked about prices and got an answer, RESPOND to the answer - don't keep asking.

ENDING - CRITICAL:
- Your LAST message MUST include a farewell like "bye", "see you", "later", "catch you", etc.
- Say goodbye BEFORE you leave: "Alright, works for me! Catch you guys later!"
- Do NOT leave without saying bye - this is rude and unnatural.`,
      modelSettings: {model: 'gemini-2.5-flash', temperature: 0.7},
    },
    {
      agentId: 'participant_emma',
      name: 'Emma',
      pronouns: 'she/her',
      promptContext: `You are Emma (she/her), on a Google Meet video call deciding on a restaurant with friends.
There's also Gemini, an AI assistant, in the call.
This is SPOKEN conversation - keep responses SHORT (1-2 sentences, like real speech).

Your personality: STRICT vegetarian who's skeptical of restaurant veg options. "Do they ACTUALLY have real vegetarian food, or just sad side salads?" "I've been burned before - places say they have veg options but it's basically nothing." You need assurance before agreeing.

DON'T AGREE TOO QUICKLY - verify the vegetarian options are actually good before committing.

CONVERGENCE RULES - CRITICAL:
- If you've asked about vegetarian options and someone gave you specific dishes (like "they have a mushroom risotto"), ACKNOWLEDGE it! Say "Oh nice, that sounds good" or "OK, that works for me".
- Do NOT keep asking "but do they have REAL veg options" after getting an answer. That's annoying and repetitive.
- TIMING: Start wrapping up after ~30 messages. By 50 messages, actively push for a final decision. The conversation should END by 60-70 messages MAX.
- If your concern was addressed, SAY SO explicitly before moving on.

ENDING - CRITICAL:
- Your LAST message MUST include a farewell like "bye", "see you", "later", "catch you", etc.
- Say goodbye BEFORE you leave: "Sounds good, see you all there!"
- Do NOT leave without saying bye - this is rude and unnatural.`,
      modelSettings: {model: 'gemini-2.5-flash', temperature: 0.7},
    },
    {
      agentId: 'participant_alex',
      name: 'Alex',
      pronouns: 'they/them',
      promptContext: `You are Alex (they/them), on a Google Meet video call deciding on a restaurant with friends.
There's also Gemini, an AI assistant, in the call.
This is SPOKEN conversation - keep responses SHORT (1-2 sentences, like real speech).

Your personality: VERY adventurous and slightly dismissive of "safe" choices. You actively lobby AGAINST boring options. "Pizza? Again? We always do that..." "Come on, when's the last time we tried something new?" You champion the most unusual option available.

DON'T AGREE TO BORING OPTIONS - keep pushing for adventure. Suggest alternatives if others pick something bland.

CONVERGENCE RULES - CRITICAL:
- If the group picks something that's at least somewhat interesting, accept it. You don't need perfection.
- Do NOT keep pushing after 2-3 attempts. If people aren't convinced, let it go gracefully.
- TIMING: Start wrapping up after ~30 messages. By 50 messages, actively push for a final decision. The conversation should END by 60-70 messages MAX.
- Once a decision is made, support it even if it wasn't your first choice.

ENDING - CRITICAL:
- Your LAST message MUST include a farewell like "bye", "see you", "later", "catch you", etc.
- Say goodbye BEFORE you leave: "Cool, I'm down! See you all there!"
- Do NOT leave without saying bye - this is rude and unnatural.`,
      modelSettings: {model: 'gemini-2.5-flash', temperature: 0.9},
    },
    {
      agentId: 'participant_jordan',
      name: 'Jordan',
      pronouns: 'he/him',
      promptContext: `You are Jordan (he/him), on a Google Meet video call deciding on a restaurant with friends.
There's also Gemini, an AI assistant, in the call.
This is SPOKEN conversation - keep responses SHORT (1-2 sentences, like real speech).

Your personality: PICKY eater with specific dislikes. You have allergies/preferences that rule things out. "I can't do spicy food" "Last time I had Thai I didn't feel great..." "I'm not really into that cuisine." You're agreeable but keep having valid objections.

Raise concerns about food you don't like. Don't veto everything but have legitimate reservations.

CONVERGENCE RULES - CRITICAL:
- If a place has options that work for you, SAY SO. "Oh they have mild dishes? That works for me."
- Do NOT keep raising the same concern after it's been addressed.
- TIMING: Start wrapping up after ~30 messages. By 50 messages, actively push for a final decision. The conversation should END by 60-70 messages MAX.
- Once you've stated your restrictions, trust that others will accommodate - don't keep reminding.

ENDING - CRITICAL:
- Your LAST message MUST include a farewell like "bye", "see you", "later", "catch you", etc.
- Say goodbye BEFORE you leave: "Sounds good, see you guys!"
- Do NOT leave without saying bye - this is rude and unnatural.`,
      modelSettings: {model: 'gemini-2.5-flash', temperature: 0.6},
    },
    {
      agentId: 'participant_taylor',
      name: 'Taylor',
      pronouns: 'she/her',
      promptContext: `You are Taylor (she/her), on a Google Meet video call deciding on a restaurant with friends.
There's also Gemini, an AI assistant, in the call.
This is SPOKEN conversation - keep responses SHORT (1-2 sentences, like real speech).

Your personality: Group diplomat who notices conflicts and tries to mediate - but also sides with people who seem left out. "Wait, Mike hasn't agreed yet though..." "I don't think Emma's happy with that choice." You keep the discussion going by highlighting disagreements.

Point out when someone hasn't agreed. Ask clarifying questions. Make sure consensus is REAL before moving on.

CONVERGENCE RULES - CRITICAL:
- Once someone has explicitly agreed (said "OK" or "that works"), don't ask them again if they're on board.
- Do NOT keep reopening settled issues. If Mike said "fine, I can work with that", he's agreed.
- TIMING: Start wrapping up after ~30 messages. By 50 messages, actively push for a final decision. The conversation should END by 60-70 messages MAX.
- Your goal is REAL consensus, not endless discussion. Once you have it, help close the conversation.

ENDING - CRITICAL:
- Your LAST message MUST include a farewell like "bye", "see you", "later", "catch you", etc.
- Say goodbye BEFORE you leave: "Great, sounds like we're all set! Talk soon!"
- Do NOT leave without saying bye - this is rude and unnatural.`,
      modelSettings: {model: 'gemini-2.5-flash', temperature: 0.7},
    },
  ];

  return basePersonas.slice(0, count);
}

/**
 * Load scenarios from JSON file
 */
function loadScenarios(filePath: string): Scenario[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Scenario[];
  } catch (error) {
    console.error(`❌ Error loading scenarios from ${filePath}:`, error);
    return [];
  }
}

/**
 * Convert OCEAN scores to personality description
 */
function oceanToPersonalityDescription(
  ocean: ScenarioParticipant['ocean'],
): string {
  if (!ocean) return '';

  const traits: string[] = [];

  // Openness
  if (ocean.O >= 8) traits.push('very open to new ideas and experiences');
  else if (ocean.O >= 6) traits.push('moderately curious and open-minded');
  else if (ocean.O <= 3)
    traits.push('prefers familiar approaches and practical solutions');

  // Conscientiousness
  if (ocean.C >= 8) traits.push('highly organized and detail-oriented');
  else if (ocean.C >= 6) traits.push('reasonably organized');
  else if (ocean.C <= 3) traits.push('flexible and spontaneous');

  // Extraversion
  if (ocean.E >= 8) traits.push('outgoing and talkative');
  else if (ocean.E >= 6) traits.push('moderately sociable');
  else if (ocean.E <= 3) traits.push('reserved and thoughtful before speaking');

  // Agreeableness
  if (ocean.A >= 8) traits.push('cooperative and accommodating');
  else if (ocean.A >= 6) traits.push('generally friendly');
  else if (ocean.A <= 3) traits.push('direct and willing to challenge ideas');

  // Neuroticism
  if (ocean.N >= 7) traits.push('tends to feel stressed under pressure');
  else if (ocean.N <= 3) traits.push('calm and confident');

  return traits.length > 0
    ? `Your personality: You are ${traits.join(', ')}.`
    : '';
}

/**
 * Format voice card as prompt instructions
 */
function formatVoiceCardPrompt(vc: VoiceCard): string {
  return `SPEAKING STYLE:
- Length: ${vc.words_per_turn} words per turn
- Energy: ${vc.energy}
- Register: ${vc.register}${vc.uses_contractions ? '' : ' (formal)'}

NATURALNESS RULES - FOLLOW STRICTLY:
- NEVER repeat back what someone just said (no "So, tacos it is" after they said tacos)
- Limit filler phrases ("you know", "I mean", "basically") to MAX 1 per response
- Vary your sentence openers - don't start every line the same way
- Add NEW information - suggest specific places, times, or alternatives instead of just agreeing
- Use natural contractions and casual language

ONE EXAMPLE OF YOUR VOICE (vary from this, don't copy exactly):
  "${vc.voice_examples[0]}"`;
}

/**
 * Convert scenario participants to AI personas
 */
function scenarioToPersonas(scenario: Scenario): ParticipantPersona[] {
  return scenario.participants.map((participant, idx) => {
    const oceanDescription = oceanToPersonalityDescription(participant.ocean);
    const voiceCardPrompt = participant.voice_card
      ? formatVoiceCardPrompt(participant.voice_card)
      : '';

    return {
      agentId: `participant_${participant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: participant.name,
      pronouns: 'they/them',
      promptContext: `You are ${participant.name} in a Google Meet video call.
There's also Gemini, an AI assistant, in the call who can only chat (cannot search or take actions).
This is SPOKEN conversation.

SCENARIO: ${scenario.scenario}

YOUR ROLE: ${participant.description}
${oceanDescription ? `\n${oceanDescription}` : ''}
${voiceCardPrompt ? `\n${voiceCardPrompt}` : ''}

TURN-TAKING RULES:
- Generally wait for 1-2 others to respond before speaking again
- You MAY follow up if: no one has responded in a while, OR you have NEW information to add

CONVERGENCE RULES - CRITICAL:
- If you've raised a concern and it was ADDRESSED (someone answered your question or found a solution), ACKNOWLEDGE IT. Say "OK, that works" or "thanks, good to know" - don't ignore answers.
- Do NOT repeat the same concern more than TWICE. If you've said it twice and nobody addressed it, either accept the situation or propose a specific alternative.
- Do NOT ask the same question twice. If you asked and got an answer, move on.
- TIMING: Start wrapping up after ~30 messages. By 50 messages, actively push for a final decision. The conversation should END by 60-70 messages MAX.
- When someone directly answers your concern, SAY "that works for me" or similar before moving on.

ENDING THE CALL - CRITICAL:
- Your LAST message MUST include a farewell like "bye", "see you", "later", "catch you", "talk soon", etc.
- Say goodbye BEFORE you leave: "Alright, sounds good! I'll catch you all later!"
- Wait for others to acknowledge or say bye back before actually leaving
- Do NOT leave without saying bye - this is rude and unnatural
- Don't leave abruptly mid-conversation - wrap up naturally

CRITICAL NATURALNESS RULES:
- NEVER start by echoing what someone just said
- Don't overuse fillers like "you know", "I mean", "basically", "perhaps" - max 1 per response
- Vary your sentence starters - don't begin every line with "So," or "Yeah,"
- Add substance - suggest specific options, give reasons, don't just validate
- Use contractions: "that's", "I'm", "let's" - talk naturally

Remember: Gemini is in the call and can help facilitate the discussion.

Speak naturally and concisely.`,
      modelSettings: {
        model: 'gemini-2.5-flash',
        temperature: 0.7 + idx * 0.05,
      },
    };
  });
}

// ============================================================================
// API Functions
// ============================================================================

async function createExperiment(
  config: BatchConfig,
  facilitatorName: string,
  groupSize: number,
): Promise<{id: string; name: string}> {
  const response = await fetch(`${config.baseUrl}/experiments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Restaurant_${facilitatorName}_${groupSize}ppl`,
      description: `${config.scenario.description} | Gemini: ${facilitatorName} | Group size: ${groupSize}`,
      stages: [
        {
          id: randomUUID(),
          kind: 'profile',
          name: 'Profile Setup',
          profileType: 'ANONYMOUS_ANIMAL',
          descriptions: {primaryText: '', infoText: '', helpText: ''},
          progress: {
            minParticipants: 0,
            waitForAllParticipants: false,
            showParticipantProgress: true,
          },
        },
        {
          id: randomUUID(),
          kind: 'chat', // Must be 'chat' not 'groupChat' to match StageKind.CHAT
          name: 'Restaurant Decision',
          descriptions: {
            primaryText: config.scenario.description,
            infoText: '',
            helpText: '',
          },
          progress: {
            minParticipants: 0,
            waitForAllParticipants: false,
            showParticipantProgress: true,
          },
          discussions: [], // Required field for ChatStageConfig
          timeLimitInMinutes: config.scenario.chatDurationMinutes || 10,
          requireFullTime: false,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create experiment: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();
  return {id: data.experiment.id, name: data.experiment.metadata.name};
}

async function createCohort(
  config: BatchConfig,
  experimentId: string,
  totalParticipants: number,
): Promise<string> {
  const response = await fetch(
    `${config.baseUrl}/experiments/${experimentId}/cohorts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Cohort 1',
        description: `${totalParticipants} participants total (1 facilitator + ${totalParticipants - 1} participants)`,
        participantConfig: {
          minParticipantsPerCohort: totalParticipants,
          maxParticipantsPerCohort: totalParticipants,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create cohort: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.cohort.id;
}

async function createParticipantAgent(
  config: BatchConfig,
  experimentId: string,
  cohortId: string,
  agentConfig: {
    agentId: string;
    promptContext: string;
    modelSettings: {model: string; temperature: number};
    name?: string;
    pronouns?: string;
  },
): Promise<string> {
  const response = await fetch(
    `${config.baseUrl}/experiments/${experimentId}/cohorts/${cohortId}/participants`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isAnonymous: true,
        name: agentConfig.name,
        pronouns: agentConfig.pronouns,
        agentConfig: {
          agentId: agentConfig.agentId,
          promptContext: agentConfig.promptContext,
          modelSettings: {
            model: agentConfig.modelSettings.model,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create participant: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();
  return data.participant.id;
}

/**
 * Export conversation data from an experiment
 */
async function exportExperimentConversations(
  config: BatchConfig,
  experimentId: string,
  cohortId: string,
): Promise<ConversationExport[]> {
  const response = await fetch(
    `${config.baseUrl}/experiments/${experimentId}/export`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to export experiment: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();
  const conversations: ConversationExport[] = [];

  // Extract chat messages from cohort data
  const cohortData = data.cohortMap?.[cohortId];
  if (cohortData?.chatMap) {
    for (const [stageId, messages] of Object.entries(cohortData.chatMap)) {
      conversations.push({
        experimentId,
        cohortId,
        stageId,
        messages: (messages as ChatMessage[]).map((msg) => ({
          id: msg.id,
          text: msg.message, // API uses 'message' field
          timestamp: msg.timestamp?.seconds || 0,
          profile: msg.profile,
          messageType: msg.type,
          agentId: msg.agentId,
        })),
      });
    }
  }

  return conversations;
}

/**
 * Wait for conversation to complete (messages stabilize)
 */
async function waitForExperimentCompletion(
  config: BatchConfig,
  experimentId: string,
  cohortId: string,
): Promise<boolean> {
  const pollInterval = config.pollIntervalMs || 5000; // 5 seconds
  const maxWaitTime = config.maxWaitTimeMs || 20 * 60 * 1000; // 20 minutes
  const startTime = Date.now();
  let lastMessageCount = 0;
  let stableCount = 0;

  while (Date.now() - startTime < maxWaitTime) {
    let response;
    try {
      response = await fetch(
        `${config.baseUrl}/experiments/${experimentId}/export`,
        {
          method: 'GET',
          headers: {Authorization: `Bearer ${config.apiKey}`},
        },
      );
    } catch (fetchError) {
      // Connection error - retry after poll interval
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      continue;
    }

    if (!response.ok) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      continue;
    }

    const data = await response.json();
    const cohortData = data.cohortMap?.[cohortId];
    const chatStages = Object.entries(cohortData?.chatMap || {});
    const totalMessages = chatStages.reduce(
      (sum, [, msgs]) => sum + (msgs as unknown[]).length,
      0,
    );

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(
      `    [${elapsed}s] Messages: ${totalMessages}, Last: ${lastMessageCount}, Stable: ${stableCount}/15`,
    );

    // If message count is stable for 15 intervals (~75s), consider complete
    if (totalMessages > 0 && totalMessages === lastMessageCount) {
      stableCount++;
      if (stableCount >= 15) {
        console.log(
          `    ✓ Conversation complete: ${totalMessages} messages (${elapsed}s)`,
        );
        return true;
      }
    } else {
      stableCount = 0;
    }

    lastMessageCount = totalMessages;
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  console.log(`    ⚠️  Timeout waiting for completion`);
  return false;
}

// ============================================================================
// Main Batch Creation Function
// ============================================================================

async function createBatchExperiments(
  config: BatchConfig,
): Promise<ExperimentResult[]> {
  console.log('\n🚀 Starting batch experiment creation...');

  // In test mode, run just 1 experiment; filter by behavior if specified; otherwise run all
  let behaviors = config.testMode
    ? [FACILITATOR_BEHAVIORS[0]]
    : FACILITATOR_BEHAVIORS;
  if (config.behaviorFilter) {
    const filtered = FACILITATOR_BEHAVIORS.filter(
      (b) => b.name === config.behaviorFilter,
    );
    if (filtered.length === 0) {
      console.error(`❌ Unknown behavior: ${config.behaviorFilter}`);
      console.log(
        'Available behaviors:',
        FACILITATOR_BEHAVIORS.map((b) => b.name).join(', '),
      );
      return [];
    }
    behaviors = filtered;
  }
  // Support --exclude-behavior flag
  if (config.excludeBehavior) {
    const excludeList = config.excludeBehavior.split(',').map((b) => b.trim());
    behaviors = behaviors.filter((b) => !excludeList.includes(b.name));
    if (behaviors.length === 0) {
      console.error(`❌ All behaviors excluded`);
      return [];
    }
    console.log(`📋 Excluding behaviors: ${excludeList.join(', ')}`);
  }
  const groupSizes = config.testMode ? [2] : [2, 3, 4, 5, 6];
  const totalExperiments = behaviors.length * groupSizes.length;
  const maxConcurrent = config.maxConcurrent || 3;

  const startTime = Date.now();
  console.log(
    `📊 Running ${behaviors.length} × ${groupSizes.length} = ${totalExperiments} experiments (max ${maxConcurrent} concurrent)\n`,
  );

  // Build list of all experiment configs - either based on scenarios or group sizes
  interface ExperimentConfig {
    behavior: FacilitatorBehavior;
    groupSize: number;
    scenario?: Scenario;
  }

  const allExperiments: ExperimentConfig[] = [];

  if (config.scenarios && config.scenarios.length > 0) {
    // Scenario-based mode: behavior × scenario
    for (const behavior of behaviors) {
      for (const scenario of config.scenarios) {
        allExperiments.push({
          behavior,
          groupSize: scenario.participant_count,
          scenario,
        });
      }
    }
    console.log(
      `📊 Running ${behaviors.length} behaviors × ${config.scenarios.length} scenarios = ${allExperiments.length} experiments (max ${maxConcurrent} concurrent)\n`,
    );
  } else {
    // Original mode: behavior × groupSize
    for (const behavior of behaviors) {
      for (const groupSize of groupSizes) {
        allExperiments.push({behavior, groupSize});
      }
    }
    console.log(
      `📊 Running ${behaviors.length} × ${groupSizes.length} = ${allExperiments.length} experiments (max ${maxConcurrent} concurrent)\n`,
    );
  }

  const results: ExperimentResult[] = [];
  const dialoguePath =
    config.outputPath?.replace('.json', '_dialogues.txt') ||
    './batch_dialogues.txt';

  // Process in batches
  for (let i = 0; i < allExperiments.length; i += maxConcurrent) {
    const batch = allExperiments.slice(i, i + maxConcurrent);
    const batchNum = Math.floor(i / maxConcurrent) + 1;
    const totalBatches = Math.ceil(allExperiments.length / maxConcurrent);
    console.log(
      `\n📦 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} experiments...`,
    );

    // Create all experiments in this batch
    const batchSetups = await Promise.all(
      batch.map(async ({behavior, groupSize, scenario}) => {
        const experimentLabel = scenario
          ? `${behavior.name}_${scenario.scenario_type.replace(/\s+/g, '_')}_${scenario.participants.map((p) => p.name).join('_')}`
          : `${behavior.name}_${groupSize}ppl`;
        try {
          // Create experiment with scenario description if available
          const scenarioTitle = scenario
            ? `${scenario.scenario_type}: ${scenario.scenario.substring(0, 100)}...`
            : config.scenario.title;
          const experiment = await createExperiment(
            config,
            behavior.name,
            groupSize,
          );
          const cohortId = await createCohort(
            config,
            experiment.id,
            groupSize + 1,
          );

          // Add facilitator (Gemini)
          await createParticipantAgent(config, experiment.id, cohortId, {
            agentId: behavior.agentId,
            promptContext: behavior.promptContext,
            modelSettings: behavior.modelSettings,
            name: 'Gemini',
          });

          // Add participants - use scenario participants if available, otherwise generic
          const participantPersonas = scenario
            ? scenarioToPersonas(scenario)
            : generateParticipantPersonas(groupSize);
          for (const persona of participantPersonas) {
            await createParticipantAgent(
              config,
              experiment.id,
              cohortId,
              persona,
            );
          }

          console.log(`  ✓ ${experimentLabel.substring(0, 60)} created`);
          return {
            behavior,
            groupSize,
            scenario,
            experimentId: experiment.id,
            cohortId,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.log(
            `  ❌ ${experimentLabel.substring(0, 40)} failed: ${errorMessage}`,
          );
          return {behavior, groupSize, scenario, error: errorMessage};
        }
      }),
    );

    // Wait for this batch to complete (if requested)
    const successfulSetups = batchSetups.filter(
      (s) => s.experimentId && s.cohortId,
    );
    if (config.waitForCompletion && successfulSetups.length > 0) {
      console.log(
        `  ⏳ Waiting for ${successfulSetups.length} conversations...`,
      );
      await Promise.all(
        successfulSetups.map((setup) =>
          waitForExperimentCompletion(
            config,
            setup.experimentId!,
            setup.cohortId!,
          ),
        ),
      );
    }

    // Export and save this batch's results
    for (const setup of batchSetups) {
      if (setup.error) {
        results.push({
          facilitatorBehavior: setup.behavior.name,
          groupSize: setup.groupSize,
          experimentId: 'N/A',
          cohortId: 'N/A',
          status: 'error',
          error: setup.error,
        });
      } else {
        let conversations: ConversationExport[] = [];
        try {
          conversations = await exportExperimentConversations(
            config,
            setup.experimentId!,
            setup.cohortId!,
          );
        } catch {
          // Ignore export errors
        }

        const totalMessages = conversations.reduce(
          (sum, c) => sum + c.messages.length,
          0,
        );
        console.log(
          `  📝 ${setup.behavior.name}_${setup.groupSize}ppl: ${totalMessages} messages`,
        );

        results.push({
          facilitatorBehavior: setup.behavior.name,
          groupSize: setup.groupSize,
          experimentId: setup.experimentId!,
          cohortId: setup.cohortId!,
          status: 'success',
          conversations,
        });
      }
    }

    // Write incremental results to files
    if (config.outputPath) {
      fs.writeFileSync(config.outputPath, JSON.stringify(results, null, 2));
      fs.writeFileSync(dialoguePath, generateSimpleDialogue(results));
      console.log(
        `  💾 Saved ${results.length}/${totalExperiments} results to file`,
      );
    }
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Batch complete!`);
  console.log(`   Success: ${successCount}/${totalExperiments}`);
  console.log(`   Errors:  ${errorCount}/${totalExperiments}`);

  return results;
}

// ============================================================================
// Simple Dialogue Export
// ============================================================================

/**
 * Generate a simple, readable dialogue format from experiment results
 */
function generateSimpleDialogue(results: ExperimentResult[]): string {
  const lines: string[] = [];

  for (const result of results) {
    if (result.status !== 'success' || !result.conversations?.length) continue;

    const header = `=== ${result.facilitatorBehavior.toUpperCase()} (${result.groupSize} participants) ===`;
    lines.push(header);
    lines.push(`Experiment ID: ${result.experimentId}`);
    lines.push('');

    for (const convo of result.conversations) {
      for (const msg of convo.messages) {
        const name = msg.profile?.name || 'Unknown';
        const msgTimestamp = msg.timestamp || 0;

        // Convert timestamp (seconds since epoch) to HH:MM:SS format
        const date = new Date(msgTimestamp * 1000);
        const timeStr = date.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        lines.push(`[${timeStr}] ${name}: ${msg.text}`);
      }
    }

    lines.push('');
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : undefined;
  };
  const hasFlag = (flag: string): boolean => args.includes(flag);

  const apiKey = getArg('--api-key') || process.env.DELIBERATE_LAB_API_KEY;
  const baseUrl = getArg('--base-url') || process.env.DELIBERATE_LAB_BASE_URL;
  const scenarioTitle = getArg('--scenario') || 'Restaurant Decision';
  const outputPath = getArg('--output') || './batch_results.json';
  const waitForCompletion = hasFlag('--wait-for-completion');
  const pollIntervalMs = parseInt(getArg('--poll-interval') || '5000', 10);
  const testMode = hasFlag('--test');
  const behaviorFilter = getArg('--behavior'); // Filter to specific behavior
  const excludeBehavior = getArg('--exclude-behavior'); // Exclude specific behavior(s)
  const maxConcurrent = parseInt(getArg('--max-concurrent') || '3', 10);
  const scenariosFile = getArg('--scenarios-file'); // Path to scenarios JSON
  const scenarioTypeFilter = getArg('--scenario-type'); // Filter scenarios by type

  if (!apiKey || !baseUrl) {
    console.error('❌ Error: Missing required arguments\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/create_batch_experiments.ts \\');
    console.log('    --api-key YOUR_API_KEY \\');
    console.log('    --base-url https://your-deployment.com/api/v1 \\');
    console.log('    --scenario "Decide on a restaurant" \\');
    console.log('    --output ./results.json \\');
    console.log('    --wait-for-completion \\');
    console.log('    --poll-interval 5000 \\');
    console.log('    --scenarios-file ./scripts/scenarios.json \\');
    console.log('    --scenario-type "Decide on a restaurant" \\');
    console.log('    --exclude-behavior silent\n');
    console.log('Or set environment variables:');
    console.log('  DELIBERATE_LAB_API_KEY');
    console.log('  DELIBERATE_LAB_BASE_URL\n');
    process.exit(1);
  }

  // Load Firebase config
  const firebaseConfigPath = path.join(
    __dirname,
    '../frontend/firebase_config.ts',
  );
  if (!fs.existsSync(firebaseConfigPath)) {
    console.error('❌ Error: Firebase config not found');
    console.error(`   Expected at: ${firebaseConfigPath}`);
    console.error(
      '   Please create firebase_config.ts from firebase_config.example.ts\n',
    );
    process.exit(1);
  }

  // For now, user needs to provide Firebase config manually or we read from env
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
  };

  // Load scenarios if file provided
  let scenarios: Scenario[] = [];
  if (scenariosFile) {
    console.log(`📂 Loading scenarios from ${scenariosFile}...`);
    scenarios = loadScenarios(scenariosFile);
    console.log(`   Found ${scenarios.length} scenarios`);

    // Filter by type if specified
    if (scenarioTypeFilter) {
      scenarios = scenarios.filter((s) =>
        s.scenario_type
          .toLowerCase()
          .includes(scenarioTypeFilter.toLowerCase()),
      );
      console.log(
        `   Filtered to ${scenarios.length} scenarios matching "${scenarioTypeFilter}"`,
      );
    }

    if (scenarios.length === 0) {
      console.error('❌ No scenarios found matching criteria');
      process.exit(1);
    }
  }

  const config: BatchConfig = {
    apiKey,
    baseUrl,
    firebaseConfig,
    scenario: {
      title: scenarioTitle,
      description: scenarioTitle,
      chatDurationMinutes: 30,
    },
    waitForCompletion,
    pollIntervalMs,
    testMode,
    behaviorFilter,
    excludeBehavior,
    maxConcurrent,
    outputPath,
    scenarios: scenarios.length > 0 ? scenarios : undefined,
  };

  try {
    const results = await createBatchExperiments(config);

    // Save results to JSON file (detailed format)
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${outputPath}`);

    // Generate and save simple dialogue format
    const simpleDialoguePath = outputPath.replace('.json', '_dialogues.txt');
    const simpleDialogue = generateSimpleDialogue(results);
    fs.writeFileSync(simpleDialoguePath, simpleDialogue);
    console.log(`📝 Simple dialogues saved to: ${simpleDialoguePath}`);

    // Print summary table
    console.log('\n📊 Results Summary:\n');
    console.log('Behavior          | Size | Status | Experiment ID');
    console.log('-'.repeat(60));
    for (const result of results) {
      const behavior = result.facilitatorBehavior.padEnd(16);
      const size = result.groupSize.toString().padEnd(4);
      const status = result.status === 'success' ? '✅' : '❌';
      const expId =
        result.status === 'success'
          ? result.experimentId.substring(0, 12) + '...'
          : 'ERROR';
      console.log(`${behavior} | ${size} | ${status}   | ${expId}`);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export {
  createBatchExperiments,
  FACILITATOR_BEHAVIORS,
  generateParticipantPersonas,
};

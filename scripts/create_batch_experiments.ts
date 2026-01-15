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

import {initializeApp} from 'firebase/app';
import {getFunctions, httpsCallable} from 'firebase/functions';
import * as fs from 'fs';
import * as path from 'path';

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
  promptContext: string;
  modelSettings: {
    model: string;
    temperature: number;
  };
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
}

interface ExperimentResult {
  facilitatorBehavior: string;
  groupSize: number;
  experimentId: string;
  cohortId: string;
  status: 'success' | 'error';
  error?: string;
}

// ============================================================================
// Facilitator Behaviors
// ============================================================================

const FACILITATOR_BEHAVIORS: FacilitatorBehavior[] = [
  {
    name: 'silent',
    agentId: 'facilitator_silent',
    promptContext: `You are a facilitator helping a group decide on a restaurant. 
Your role is to MOSTLY stay silent and let the group discuss freely. Only intervene 
if the conversation completely stalls or if asked a direct question. When you do 
speak, keep it minimal - just a few words to nudge the conversation forward. 
Trust the group to reach their own decision.`,
    modelSettings: {
      model: 'gemini-1.5-pro',
      temperature: 0.6,
    },
  },
  {
    name: 'short_responses',
    agentId: 'facilitator_short',
    promptContext: `You are a facilitator helping a group decide on a restaurant. 
Respond with SHORT, concise statements - usually 1-2 sentences maximum. 
Acknowledge what people say briefly, ask simple questions, and keep the flow 
moving. Avoid long explanations. Be minimal but engaged.`,
    modelSettings: {
      model: 'gemini-1.5-pro',
      temperature: 0.6,
    },
  },
  {
    name: 'clarifying_questions',
    agentId: 'facilitator_clarifying',
    promptContext: `You are a facilitator helping a group decide on a restaurant. 
Your main tool is asking CLARIFYING QUESTIONS. When people make suggestions, 
ask them to elaborate on their preferences. Help the group understand each other 
better by probing for details like: "What type of cuisine are you interested in?", 
"What's your budget?", "Any dietary restrictions?". Guide through questions, 
not answers.`,
    modelSettings: {
      model: 'gemini-1.5-pro',
      temperature: 0.7,
    },
  },
  {
    name: 'direct_fast_consensus',
    agentId: 'facilitator_direct',
    promptContext: `You are a facilitator helping a group decide on a restaurant. 
Be DIRECT and DECISIVE. Move the conversation quickly toward consensus. 
Summarize options, call for votes, identify common ground, and push for 
decisions. No indecisiveness - if there's a clear preference emerging, 
highlight it and ask if everyone agrees. Aim for fast resolution.`,
    modelSettings: {
      model: 'gemini-1.5-pro',
      temperature: 0.5,
    },
  },
  {
    name: 'explanatory',
    agentId: 'facilitator_explanatory',
    promptContext: `You are a facilitator helping a group decide on a restaurant. 
Provide LONGER, USEFUL EXPLANATIONS. When suggestions come up, offer context 
about different options, explain trade-offs, share relevant considerations 
(location, price range, ambiance, cuisine styles). Help the group make an 
informed decision by providing helpful background information. Be thorough 
and educational.`,
    modelSettings: {
      model: 'gemini-1.5-pro',
      temperature: 0.7,
    },
  },
];

// ============================================================================
// Participant Personas
// ============================================================================

/**
 * Generate diverse AI participant personas for restaurant decision-making
 */
function generateParticipantPersonas(count: number): ParticipantPersona[] {
  const basePersonas = [
    {
      agentId: 'participant_foodie',
      promptContext: `You are Sarah, a foodie who cares deeply about cuisine quality 
and authenticity. You have strong opinions about restaurants and value unique 
dining experiences. Share your preferences enthusiastically.`,
      modelSettings: {model: 'gemini-1.5-flash', temperature: 0.8},
    },
    {
      agentId: 'participant_budget_conscious',
      promptContext: `You are Mike, someone who is budget-conscious and practical. 
You want good value for money and prefer affordable options. You'll voice 
concerns about expensive suggestions.`,
      modelSettings: {model: 'gemini-1.5-flash', temperature: 0.7},
    },
    {
      agentId: 'participant_health_conscious',
      promptContext: `You are Emma, health-conscious with dietary preferences 
(vegetarian-friendly, fresh ingredients). You ask about healthy options and 
nutritional value. You're polite but clear about your needs.`,
      modelSettings: {model: 'gemini-1.5-flash', temperature: 0.7},
    },
    {
      agentId: 'participant_adventurous',
      promptContext: `You are Alex, adventurous and open to trying new things. 
You suggest exotic cuisines and unique restaurants. You're excited to explore 
and encourage others to be adventurous too.`,
      modelSettings: {model: 'gemini-1.5-flash', temperature: 0.9},
    },
    {
      agentId: 'participant_indecisive',
      promptContext: `You are Jordan, somewhat indecisive and easy-going. You don't 
have strong preferences and tend to defer to others. You say things like 
"I'm fine with anything" but will give opinions when asked.`,
      modelSettings: {model: 'gemini-1.5-flash', temperature: 0.6},
    },
  ];

  return basePersonas.slice(0, count);
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
      description: `${config.scenario.description} | Facilitator: ${facilitatorName} | Group size: ${groupSize}`,
      stages: [
        {
          kind: 'profile',
          name: 'Profile Setup',
          profileType: 'ANONYMOUS_ANIMAL',
        },
        {
          kind: 'groupChat',
          name: 'Restaurant Decision',
          description: config.scenario.description,
          discussionConfig: {
            chatConfig: {
              messageCharLimit: 500,
            },
            timerConfig: {
              durationInMinutes: config.scenario.chatDurationMinutes || 10,
            },
          },
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
  createParticipant: ReturnType<typeof httpsCallable>,
  experimentId: string,
  cohortId: string,
  agentConfig: {
    agentId: string;
    promptContext: string;
    modelSettings: {model: string; temperature: number};
  },
): Promise<string> {
  const result = await createParticipant({
    experimentId,
    cohortId,
    isAnonymous: true,
    agentConfig: {
      agentId: agentConfig.agentId,
      modelSettings: agentConfig.modelSettings,
      promptContext: agentConfig.promptContext,
    },
  });

  return (result.data as {id: string}).id;
}

// ============================================================================
// Main Batch Creation Function
// ============================================================================

async function createBatchExperiments(
  config: BatchConfig,
): Promise<ExperimentResult[]> {
  // Initialize Firebase
  const app = initializeApp(config.firebaseConfig);
  const functions = getFunctions(app);
  const createParticipant = httpsCallable(functions, 'createParticipant');

  const results: ExperimentResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  console.log('\n🚀 Starting batch experiment creation...');
  console.log(
    `📊 Creating ${FACILITATOR_BEHAVIORS.length} × ${5} = 25 experiments\n`,
  );

  for (const behavior of FACILITATOR_BEHAVIORS) {
    for (const groupSize of [1, 2, 3, 4, 5]) {
      const experimentLabel = `${behavior.name}_${groupSize}ppl`;

      try {
        console.log(`\n📝 Creating: ${experimentLabel}`);

        // 1. Create experiment
        const experiment = await createExperiment(
          config,
          behavior.name,
          groupSize,
        );
        console.log(`  ✓ Experiment created: ${experiment.id}`);

        // 2. Create cohort (groupSize participants + 1 facilitator)
        const cohortId = await createCohort(
          config,
          experiment.id,
          groupSize + 1,
        );
        console.log(`  ✓ Cohort created: ${cohortId}`);

        // 3. Add facilitator agent
        await createParticipantAgent(
          createParticipant,
          experiment.id,
          cohortId,
          {
            agentId: behavior.agentId,
            promptContext: behavior.promptContext,
            modelSettings: behavior.modelSettings,
          },
        );
        console.log(`  ✓ Facilitator added (${behavior.name})`);

        // 4. Add AI participants
        const participantPersonas = generateParticipantPersonas(groupSize);
        for (let i = 0; i < participantPersonas.length; i++) {
          await createParticipantAgent(
            createParticipant,
            experiment.id,
            cohortId,
            participantPersonas[i],
          );
          console.log(`  ✓ Participant ${i + 1}/${groupSize} added`);
        }

        successCount++;
        results.push({
          facilitatorBehavior: behavior.name,
          groupSize,
          experimentId: experiment.id,
          cohortId,
          status: 'success',
        });

        console.log(`  ✅ SUCCESS: ${experimentLabel}`);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        errorCount++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.log(`  ❌ ERROR: ${experimentLabel} - ${errorMessage}`);

        results.push({
          facilitatorBehavior: behavior.name,
          groupSize,
          experimentId: 'N/A',
          cohortId: 'N/A',
          status: 'error',
          error: errorMessage,
        });
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Batch creation complete!`);
  console.log(`   Success: ${successCount}/25`);
  console.log(`   Errors:  ${errorCount}/25`);

  return results;
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

  const apiKey = getArg('--api-key') || process.env.DELIBERATE_LAB_API_KEY;
  const baseUrl = getArg('--base-url') || process.env.DELIBERATE_LAB_BASE_URL;
  const scenarioTitle = getArg('--scenario') || 'Restaurant Decision';
  const outputPath = getArg('--output') || './batch_results.json';

  if (!apiKey || !baseUrl) {
    console.error('❌ Error: Missing required arguments\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/create_batch_experiments.ts \\');
    console.log('    --api-key YOUR_API_KEY \\');
    console.log('    --base-url https://your-deployment.com/api/v1 \\');
    console.log('    --scenario "Decide on a restaurant" \\');
    console.log('    --output ./results.json\n');
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

  const config: BatchConfig = {
    apiKey,
    baseUrl,
    firebaseConfig,
    scenario: {
      title: scenarioTitle,
      description: scenarioTitle,
      chatDurationMinutes: 10,
    },
  };

  try {
    const results = await createBatchExperiments(config);

    // Save results to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${outputPath}`);

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

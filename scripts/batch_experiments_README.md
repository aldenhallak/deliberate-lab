# Batch Experiment Creation Script

## Overview

This script automates the creation of **25 experiments** for studying how different facilitator behaviors interact with group size in a restaurant decision-making scenario.

**Factorial Design:**
- 5 facilitator behaviors (silent, short responses, clarifying questions, direct, explanatory)
- 5 group sizes (1-5 AI participants + 1 facilitator)
- = 25 unique experiment configurations

## Prerequisites

1. **Deliberate Lab API Key**: Generate from Settings → Deliberate Lab API Access
2. **Firebase Configuration**: Required for `createParticipant` callable function
3. **Dependencies**: `tsx` and `firebase` npm packages

## Installation

```bash
cd /Users/hallak/Documents/deliberate-lab/deliberate-lab
npm install tsx firebase  # If not already installed
```

## Configuration

### Option 1: Environment Variables

```bash
export DELIBERATE_LAB_API_KEY="your_api_key_here"
export DELIBERATE_LAB_BASE_URL="https://your-deployment.com/api/v1"

# Firebase config
export FIREBASE_API_KEY="your_firebase_api_key"
export FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
export FIREBASE_MESSAGING_SENDER_ID="123456789"
export FIREBASE_APP_ID="1:123456789:web:abc123"
```

### Option 2: Command-Line Arguments

```bash
npx tsx scripts/create_batch_experiments.ts \
  --api-key YOUR_API_KEY \
  --base-url https://your-deployment.com/api/v1 \
  --scenario "Decide on a restaurant. User wants help to decide on a restaurant." \
  --output ./results.json
```

## Usage

### Basic Usage

```bash
npx tsx scripts/create_batch_experiments.ts \
  --scenario "Decide on a restaurant"
```

### Full Example

```bash
npx tsx scripts/create_batch_experiments.ts \
  --api-key "dlk_abc123..." \
  --base-url "https://deliberate-lab.web.app/api/v1" \
  --scenario "Decide on a restaurant. User wants help to decide on a restaurant." \
  --output ./restaurant_experiments.json
```

## What It Creates

For each of the 25 combinations, the script:

1. **Creates an experiment** with:
   - Name: `Restaurant_{behavior}_{groupSize}ppl` (e.g., `Restaurant_silent_3ppl`)
   - 2 stages: Profile → Group Chat
   - Chat duration: 10 minutes

2. **Creates a cohort** configured for:
   - Exact participant count (groupSize + 1)
   - All AI participants

3. **Adds a facilitator agent** with specific behavior:
   - **Silent**: Minimal intervention
   - **Short Responses**: 1-2 sentences
   - **Clarifying Questions**: Guides through questions
   - **Direct**: Pushes for fast consensus
   - **Explanatory**: Longer, detailed responses

4. **Adds N AI participants** with diverse personas:
   - Foodie (quality-focused)
   - Budget-conscious
   - Health-conscious
   - Adventurous
   - Indecisive

## Output

The script generates a JSON file with results:

```json
[
  {
    "facilitatorBehavior": "silent",
    "groupSize": 1,
    "experimentId": "exp_abc123",
    "cohortId": "cohort_xyz789",
    "status": "success"
  },
  {
    "facilitatorBehavior": "silent",
    "groupSize": 2,
    "experimentId": "exp_def456",
    "cohortId": "cohort_uvw012",
    "status": "success"
  },
  ...
]
```

It also prints a summary table:

```
📊 Results Summary:

Behavior          | Size | Status | Experiment ID
------------------------------------------------------------
silent            | 1    | ✅   | exp_abc123...
silent            | 2    | ✅   | exp_def456...
short_responses   | 1    | ✅   | exp_ghi789...
...
```

## Expected Runtime

- **Single experiment**: ~5-10 seconds
- **Full batch (25 experiments)**: ~30-45 minutes

The script includes 1-second delays between experiments to avoid rate limiting.

## Monitoring Progress

The script outputs detailed progress:

```
🚀 Starting batch experiment creation...
📊 Creating 5 × 5 = 25 experiments

📝 Creating: silent_1ppl
  ✓ Experiment created: exp_abc123
  ✓ Cohort created: cohort_xyz789
  ✓ Facilitator added (silent)
  ✓ Participant 1/1 added
  ✅ SUCCESS: silent_1ppl

📝 Creating: silent_2ppl
  ...
```

## Troubleshooting

### "Failed to create experiment: 401"
- **Cause**: Invalid or expired API key
- **Solution**: Regenerate API key from Deliberate Lab settings

### "Failed to create experiment: 404"
- **Cause**: Incorrect base URL
- **Solution**: Verify the URL points to `/api/v1` endpoint

### "Firebase config not found"
- **Cause**: Missing Firebase environment variables
- **Solution**: Set all required Firebase config variables

### "Too many requests" (429 error)
- **Cause**: Rate limiting (100 requests per 15 minutes)
- **Solution**: Increase delay in script or wait before retrying

### Script hangs on "Creating..."
- **Cause**: Firebase callable function timeout
- **Solution**: 
  - Check Firebase Cloud Functions are deployed
  - Verify LLM API keys are configured in your deployment

## Customization

### Modify Facilitator Behaviors

Edit the `FACILITATOR_BEHAVIORS` array in the script:

```typescript
{
  name: 'custom_behavior',
  agentId: 'facilitator_custom',
  promptContext: `Your custom prompt here...`,
  modelSettings: {
    model: 'gemini-1.5-pro',
    temperature: 0.7,
  },
}
```

### Modify Participant Personas

Edit the `generateParticipantPersonas()` function:

```typescript
const basePersonas = [
  {
    agentId: 'participant_custom',
    promptContext: `Your custom persona...`,
    modelSettings: { model: 'gemini-1.5-flash', temperature: 0.8 },
  },
  ...
];
```

### Change Chat Duration

Modify in the config:

```typescript
scenario: {
  title: scenarioTitle,
  description: scenarioTitle,
  chatDurationMinutes: 15,  // Change this
},
```

## Next Steps

After running the script:

1. **Monitor conversations** in the Deliberate Lab dashboard
2. **Export data** using the experiment export API
3. **Analyze results** to compare facilitator effectiveness across group sizes

## Support

- [Deliberate Lab Documentation](https://pair-code.github.io/deliberate-lab/)
- [API Guide](file:///Users/hallak/.gemini/jetski/brain/218c97a5-b867-4a8d-b732-bbd0a17c626f/multi_agent_conversation_guide.md)

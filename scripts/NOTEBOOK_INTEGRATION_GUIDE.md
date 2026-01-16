# Batch Experiment Creation - Notebook Integration Guide

## Overview

This guide explains how to add cells to your `scenario_and_dialogue_generation.ipynb` notebook to create **25 experiments** (5 scenarios × 5 facilitator behaviors) with live AI agents.

## Setup Instructions

### 1. Prerequisites

Before adding the new cells, ensure you have:

- ✅ **Deliberate Lab API Key**: Generated from Settings → Deliberate Lab API Access
- ✅ **Firebase Service Account JSON**: Downloaded from Firebase Console → Project Settings → Service Accounts
- ✅ **Scenarios Generated**: Run the scenario generation cells in the notebook first

### 2. Add New Cells to Notebook

The file [`scripts/notebook_cells_batch_experiments.py`](file:///Users/hallak/Documents/deliberate-lab/deliberate-lab/scripts/notebook_cells_batch_experiments.py) contains 8 cells to add to your notebook.

**Where to add them:** After the "Transcript generation from scenarios" section (around line 450 in the notebook).

**How to add:**

1. Open the notebook in Jupyter/Colab
2. Create a new **Markdown cell** with title: `# Batch Experiment Creation`
3. For each `# CELL X:` section in the Python file:
   - Create a new **Code cell**
   - Copy the code from that section
   - Paste into the cell
4. Run cells in order (1 → 8)

## Cell-by-Cell Breakdown

### Cell 1: Install Dependencies
```python
!pip install firebase-admin requests
```
Installs required packages. Run once per session.

### Cell 2: Configuration
**Important:** Update these values before running:
- `DELIBERATE_LAB_API_KEY`: Your API key from Deliberate Lab
- `DELIBERATE_LAB_BASE_URL`: Your deployment URL + `/api/v1`
- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Path to downloaded service account JSON

### Cell 3: Facilitator Behaviors
Defines the 5 facilitator agent behaviors:
1. **Silent**: Minimal intervention
2. **Short Responses**: Brief 1-2 sentences
3. **Clarifying Questions**: Guides through questions
4. **Direct/Fast Consensus**: Pushes for quick decisions
5. **Explanatory**: Longer, detailed responses

No changes needed.

### Cell 4: REST API Helpers
Helper functions for creating experiments and cohorts via the REST API.

No changes needed.

### Cell 5: Firebase Callable Helpers
Helper function for creating agent participants using Firebase.

**Note:** If your Firebase Functions are deployed in a different region than `us-central1`, update the `region` variable in this cell.

### Cell 6: Scenario Selection
Automatically selects one scenario per group size (1-5 participants) from the 12 generated scenarios.

No changes needed.

### Cell 7: Batch Creation (MAIN)
**This is the main cell that creates all 25 experiments.**

It will:
- Loop through 5 scenarios × 5 behaviors = 25 experiments
- For each combination:
  - Create experiment with Profile + Group Chat stages
  - Create cohort with correct participant count
  - Add facilitator agent
  - Add participant agents (with personas from scenarios)

**Duration:** ~25-30 minutes for all 25 experiments (1 min per experiment).

**Progress:** Detailed console output shows progress for each experiment.

### Cell 8: Results Export
Displays results summary and exports to JSON/CSV files.

Downloads files automatically if running in Google Colab.

## Expected Output

### Console Output Example
```
🚀 Starting batch creation: 5 scenarios × 5 behaviors = 25 experiments

================================================================================

[1/25] Creating: silent_group1
  Scenario: A user is feeling indecisive about what to eat for dinner...
  ✓ Experiment created: exp_abc123
  ✓ Cohort created: cohort_xyz789
  ✓ Facilitator added (silent)
  ✓ Participant 1/1 added (Alex)
  ✅ SUCCESS: silent_group1

[2/25] Creating: silent_group2
  ...
```

### Results Files

**batch_experiment_results.json:**
```json
[
  {
    "facilitatorBehavior": "silent",
    "groupSize": 1,
    "experimentId": "exp_abc123",
    "cohortId": "cohort_xyz789",
    "status": "success"
  },
  ...
]
```

**batch_experiment_results.csv:**
```
facilitatorBehavior,groupSize,experimentId,cohortId,status
silent,1,exp_abc123,cohort_xyz789,success
silent,2,exp_def456,cohort_uvw012,success
...
```

## Monitoring Live Conversations

Once experiments are created:

1. Go to your Deliberate Lab dashboard
2. Navigate to the experiment list
3. Click on any experiment (e.g., "Restaurant_silent_group3")
4. Click on the cohort
5. **Watch the agents converse in real-time!**

The agents will autonomously:
- Complete the Profile stage (set name/avatar based on persona)
- Enter the Group Chat stage
- Discuss and try to decide on a restaurant
- Each facilitator will behave differently based on their configuration

## Troubleshooting

### "Failed to create experiment: 401"
- **Issue**: Invalid API key
- **Fix**: Regenerate API key in Deliberate Lab settings, update Cell 2

### "Failed to create participant: 404"
- **Issue**: Firebase Functions region mismatch
- **Fix**: Update `region` variable in Cell 5 to match your deployment

### "No scenario found for group size X"
- **Issue**: Scenario generation didn't produce scenarios for all group sizes
- **Fix**: Re-run scenario generation cells with adjusted prompts

### Rate Limiting (429 errors)
- **Issue**: Too many API requests
- **Fix**: Increase `time.sleep(1)` to `time.sleep(2)` in Cell 7

### Script hangs or times out
- **Issue**: Firebase callable function not responding
- **Fix**: Check that Cloud Functions are deployed and LLM API keys are configured

## Customization

### Change Chat Duration
In Cell 7, modify:
```python
batch_results = create_batch_experiments(
    ...
    chat_duration_minutes=15  # Change from 10 to 15 minutes
)
```

### Modify Facilitator Behaviors
Edit the `promptContext` strings in Cell 3 to change how facilitators behave.

### Use Different LLM Models
In Cell 3 (facilitator) or Cell 7 (participants), change:
```python
'model': 'gpt-4',  # Instead of gemini-1.5-pro
```

### Adjust Participant Personas
The participant personas come from the scenario generation. To modify:
- Edit the `scenario_guidance` and `user_guidance` in earlier notebook cells
- Re-run scenario generation
- Then run batch creation cells

## Next Steps

After experiments are created:

1. **Monitor conversations** in Deliberate Lab UI
2. **Export data** using the experiment export API
3. **Analyze results** to compare facilitator effectiveness across group sizes
4. **Iterate** on facilitator behaviors based on observations

## Support

- [Deliberate Lab Documentation](https://pair-code.github.io/deliberate-lab/)
- [Multi-Agent Conversation Guide](file:///Users/hallak/.gemini/jetski/brain/218c97a5-b867-4a8d-b732-bbd0a17c626f/multi_agent_conversation_guide.md)
- [Implementation Plan](file:///Users/hallak/.gemini/jetski/brain/218c97a5-b867-4a8d-b732-bbd0a17c626f/implementation_plan.md)

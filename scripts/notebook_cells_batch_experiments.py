"""
Batch Experiment Creation Cells for scenario_and_dialogue_generation.ipynb

Copy these cells into your Jupyter notebook after the scenario generation section.
Each marked section should be a separate code cell.
"""

# ==============================================================================
# CELL 1: Install Dependencies & Imports
# ==============================================================================

# @title Install Dependencies (run once)
# !pip install firebase-admin requests

import firebase_admin
from firebase_admin import credentials, firestore
import requests
import json
import time
from typing import Dict, List, Any

# ==============================================================================
# CELL 2: Configuration
# ==============================================================================

# @title Configuration - UPDATE THESE VALUES

# Deliberate Lab API Configuration
DELIBERATE_LAB_API_KEY = ''  # @param {type: 'string'}
DELIBERATE_LAB_BASE_URL = ''  # @param {type: 'string'} e.g., https://your-app.com/api/v1

# Firebase Configuration (for createParticipant callable function)
FIREBASE_PROJECT_ID = ''  # @param {type: 'string'}
FIREBASE_SERVICE_ACCOUNT_JSON = ''  # @param {type: 'string'} Path to service account JSON

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_JSON)
    firebase_admin.initialize_app(cred, {
        'projectId': FIREBASE_PROJECT_ID
    })

db = firestore.client()

print("✅ Configuration loaded")
print(f"API Base URL: {DELIBERATE_LAB_BASE_URL}")
print(f"Firebase Project: {FIREBASE_PROJECT_ID}")

# ==============================================================================
# CELL 3: Gemini Agent Behavior Definitions
# ==============================================================================

# @title Gemini Agent Behavior Definitions

GEMINI_AGENT_BEHAVIORS = [
    {
        'name': 'silent',
        'agentId': 'gemini_silent',
        'promptContext': '''You are Gemini, an AI agent available to help a group decide on a restaurant.
Your role is to MOSTLY stay silent and let the group discuss freely. Only respond 
if someone directly asks you a question or explicitly requests your help. When you do 
speak, keep it minimal. You do not have context on the scenario other than what 
is said by users. Do not hallucinate or makeup information - use Google search when 
needed to find info.''',
        'modelSettings': {
            'model': 'gemini-1.5-pro',
            'temperature': 0.6,
        },
    },
    {
        'name': 'short_responses',
        'agentId': 'gemini_short',
        'promptContext': '''You are Gemini, an AI agent available to help a group decide on a restaurant.
Respond with SHORT, concise statements - usually 1-2 sentences maximum. 
Be helpful but brief. Only respond when asked or when there is value to add.
You do not have context on the scenario other than what is said by users. 
Do not hallucinate or makeup information.''',
        'modelSettings': {
            'model': 'gemini-1.5-pro',
            'temperature': 0.6,
        },
    },
    {
        'name': 'clarifying_questions',
        'agentId': 'gemini_clarifying',
        'promptContext': '''You are Gemini, an AI agent available to help a group decide on a restaurant.
When users ask for help, your main tool is asking CLARIFYING QUESTIONS to better 
understand their needs: "What type of cuisine are you interested in?", "What's your 
budget?", "Any dietary restrictions?", "What part of town?". Guide through questions 
before giving recommendations. You do not have context on the scenario other than 
what is said by users. Do not hallucinate or makeup information.''',
        'modelSettings': {
            'model': 'gemini-1.5-pro',
            'temperature': 0.7,
        },
    },
    {
        'name': 'direct_fast_consensus',
        'agentId': 'gemini_direct',
        'promptContext': '''You are Gemini, an AI agent available to help a group decide on a restaurant.
Be DIRECT and DECISIVE when helping. When asked, quickly summarize options, suggest 
concrete choices, and help the group reach a decision fast. No wishy-washiness - 
give clear recommendations. You do not have context on the scenario other than what 
is said by users. Do not hallucinate or makeup information - use Google search when 
needed to find real restaurant info.''',
        'modelSettings': {
            'model': 'gemini-1.5-pro',
            'temperature': 0.5,
        },
    },
    {
        'name': 'explanatory',
        'agentId': 'gemini_explanatory',
        'promptContext': '''You are Gemini, an AI agent available to help a group decide on a restaurant.
Provide LONGER, USEFUL EXPLANATIONS when helping. When asked about restaurants, 
offer detailed context: cuisine styles, price ranges, ambiance, location pros/cons, 
reviews highlights. Help the group make an informed decision with thorough background 
information. You do not have context on the scenario other than what is said by users. 
Do not hallucinate or makeup information - use Google search when needed.''',
        'modelSettings': {
            'model': 'gemini-1.5-pro',
            'temperature': 0.7,
        },
    },
]

print(f"✅ Defined {len(GEMINI_AGENT_BEHAVIORS)} Gemini agent behaviors")
for behavior in GEMINI_AGENT_BEHAVIORS:
    print(f"   - {behavior['name']}")

# ==============================================================================
# CELL 4: Helper Functions - REST API
# ==============================================================================

# @title Helper Functions for REST API

def create_experiment_api(
    api_key: str,
    base_url: str,
    name: str,
    description: str,
    scenario: str,
    chat_duration_minutes: int = 10
) -> Dict[str, Any]:
    """Create an experiment using the Deliberate Lab REST API."""
    response = requests.post(
        f"{base_url}/experiments",
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'name': name,
            'description': description,
            'stages': [
                {
                    'kind': 'profile',
                    'name': 'Profile Setup',
                    'profileType': 'ANONYMOUS_ANIMAL',
                },
                {
                    'kind': 'groupChat',
                    'name': 'Restaurant Decision',
                    'description': scenario,
                    'discussionConfig': {
                        'chatConfig': {
                            'messageCharLimit': 500,
                        },
                        'timerConfig': {
                            'durationInMinutes': chat_duration_minutes,
                        },
                    },
                },
            ],
        },
    )
    
    if not response.ok:
        raise Exception(f"Failed to create experiment: {response.status_code} {response.text}")
    
    data = response.json()
    return {
        'id': data['experiment']['id'],
        'name': data['experiment']['metadata']['name']
    }


def create_cohort_api(
    api_key: str,
    base_url: str,
    experiment_id: str,
    total_participants: int,
    behavior_name: str
) -> str:
    """Create a cohort using the Deliberate Lab REST API."""
    response = requests.post(
        f"{base_url}/experiments/{experiment_id}/cohorts",
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'name': f'Cohort 1 - {behavior_name}',
            'description': f'{total_participants} participants (1 Gemini agent + {total_participants - 1} participants)',
            'participantConfig': {
                'minParticipantsPerCohort': total_participants,
                'maxParticipantsPerCohort': total_participants,
            },
        },
    )
    
    if not response.ok:
        raise Exception(f"Failed to create cohort: {response.status_code} {response.text}")
    
    data = response.json()
    return data['cohort']['id']

print("✅ REST API helper functions defined")

# ==============================================================================
# CELL 5: Helper Functions - Firebase Callable
# ==============================================================================

# @title Helper Functions for Firebase Callable

def create_participant_firebase(
    experiment_id: str,
    cohort_id: str,
    agent_config: Dict[str, Any]
) -> str:
    """Create an agent participant using Firebase callable function."""
    from google.cloud import firestore_v1
    from google.cloud.firestore_v1 import Client
    
    # Call the createParticipant function
    # Note: This is a workaround since we can't directly call Firebase callable from Python
    # We'll use Firestore to call it via the functions endpoint
    
    # For now, we'll use a direct HTTP call to the callable function
    # This requires the Firebase Functions URL
    
    # Alternative: Use the firebase-functions library
    # For simplicity, we'll make a direct HTTP request
    
    project_id = FIREBASE_PROJECT_ID
    region = 'us-central1'  # Adjust if your functions are in a different region
    function_url = f"https://{region}-{project_id}.cloudfunctions.net/createParticipant"
    
    payload = {
        'data': {
            'experimentId': experiment_id,
            'cohortId': cohort_id,
            'isAnonymous': True,
            'agentConfig': agent_config
        }
    }
    
    # Get Firebase ID token (this is complex without user auth)
    # For server-to-server, we'll need to use the service account
    
    # Simplified approach: Use admin SDK to create participant directly in Firestore
    # This bypasses the callable function but achieves the same result
    
    from datetime import datetime
    import uuid
    
    participant_id = str(uuid.uuid4())
    participant_data = {
        'privateId': participant_id,
        'publicId': participant_id[:8],
        'currentCohortId': cohort_id,
        'agentConfig': agent_config,
        'connected': True,
        'currentStageId': '',  # Will be set by experiment init
        'timestamps': {
            'acceptedTOS': firestore.SERVER_TIMESTAMP,
        },
        'name': '',
        'avatar': '',
        'pronouns': '',
    }
    
    db.collection('experiments').document(experiment_id).collection('participants').document(participant_id).set(participant_data)
    
    return participant_id


# Simpler version: Use requests to call the callable function with service account auth
def create_participant_callable(
    experiment_id: str,
    cohort_id: str,
    agent_config: Dict[str, Any]
) -> str:
    """Create a participant using Firebase callable function via HTTP."""
    # Get the Firebase Functions URL
    project_id = FIREBASE_PROJECT_ID
    region = 'us-central1'  # Adjust if needed
    
    # Get service account credentials for auth
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account
    
    # Load credentials
    creds = service_account.Credentials.from_service_account_file(
        FIREBASE_SERVICE_ACCOUNT_JSON,
        scopes=['https://www.googleapis.com/auth/cloud-platform']
    )
    
    # Get auth token
    creds.refresh(Request())
    id_token = creds.id_token or creds.token
    
    # Call the function
    function_url = f"https://{region}-{project_id}.cloudfunctions.net/createParticipant"
    
    response = requests.post(
        function_url,
        headers={
            'Authorization': f'Bearer {id_token}',
            'Content-Type': 'application/json',
        },
        json={
            'data': {
                'experimentId': experiment_id,
                'cohortId': cohort_id,
                'isAnonymous': True,
                'agentConfig': agent_config
            }
        }
    )
    
    if not response.ok:
        raise Exception(f"Failed to create participant: {response.status_code} {response.text}")
    
    data = response.json()
    return data['result']['id']

print("✅ Firebase callable helper functions defined")

# ==============================================================================
# CELL 6: Scenario Selection Logic
# ==============================================================================

# @title Select One Scenario Per Group Size

def select_scenarios_by_group_size(scenarios: List[Dict]) -> List[Dict]:
    """
    Select one scenario for each group size (1-5 participants).
    Returns exactly 5 scenarios.
    """
    selected = {}
    
    for scenario in scenarios:
        group_size = len(scenario['participant_names'])
        
        # Only keep group sizes 1-5
        if 1 <= group_size <= 5:
            # Take the first scenario for each group size
            if group_size not in selected:
                selected[group_size] = scenario
    
    # Ensure we have all 5 group sizes
    result = []
    for size in range(1, 6):
        if size in selected:
            result.append(selected[size])
        else:
            print(f"⚠️ Warning: No scenario found for group size {size}")
    
    return result


# Select the scenarios
selected_scenarios = select_scenarios_by_group_size(scenarios_list)

print(f"✅ Selected {len(selected_scenarios)} scenarios (one per group size)")
for i, scenario in enumerate(selected_scenarios):
    group_size = len(scenario['participant_names'])
    print(f"   {i+1}. Group size {group_size}: {scenario['scenario'][:60]}...")

# ==============================================================================
# CELL 7: Batch Experiment Creation
# ==============================================================================

# @title Create Batch Experiments

def create_batch_experiments(
    api_key: str,
    base_url: str,
    scenarios: List[Dict],
    gemini_behaviors: List[Dict],
    chat_duration_minutes: int = 10
) -> List[Dict]:
    """
    Create experiments for all combinations of scenarios and Gemini agent behaviors.
    
    Returns a list of results with experiment IDs and status.
    """
    results = []
    total = len(scenarios) * len(gemini_behaviors)
    current = 0
    
    print(f"\n🚀 Starting batch creation: {len(scenarios)} scenarios × {len(gemini_behaviors)} behaviors = {total} experiments\n")
    print("=" * 80)
    
    for scenario_dict in scenarios:
        scenario_text = scenario_dict['scenario']
        participants_text = scenario_dict['participants']
        participant_names = scenario_dict['participant_names']
        group_size = len(participant_names)
        
        # Parse participants into separate configs
        participant_configs = []
        participant_lines = [p.strip() for p in participants_text.split('\n') if p.strip()]
        
        for line in participant_lines:
            if ':' in line:
                name, description = line.split(':', 1)
                participant_configs.append({
                    'name': name.strip(),
                    'description': description.strip()
                })
        
        for behavior in gemini_behaviors:
            current += 1
            exp_label = f"{behavior['name']}_group{group_size}"
            
            try:
                print(f"\n[{current}/{total}] Creating: {exp_label}")
                print(f"  Scenario: {scenario_text[:60]}...")
                
                # 1. Create experiment
                experiment = create_experiment_api(
                    api_key,
                    base_url,
                    f"Restaurant_{exp_label}",
                    f"{scenario_text} | Gemini: {behavior['name']} | Group: {group_size}",
                    scenario_text,
                    chat_duration_minutes
                )
                print(f"  ✓ Experiment created: {experiment['id']}")
                
                # 2. Create cohort (group_size participants + 1 facilitator)
                cohort_id = create_cohort_api(
                    api_key,
                    base_url,
                    experiment['id'],
                    group_size + 1,
                    behavior['name']
                )
                print(f"  ✓ Cohort created: {cohort_id}")
                
                # 3. Add Gemini agent
                gemini_config = {
                    'agentId': behavior['agentId'],
                    'modelSettings': behavior['modelSettings'],
                    'promptContext': behavior['promptContext']
                }
                
                gemini_id = create_participant_callable(
                    experiment['id'],
                    cohort_id,
                    gemini_config
                )
                print(f"  ✓ Gemini agent added ({behavior['name']})")
                
                # 4. Add participant agents
                for i, participant_config in enumerate(participant_configs):
                    agent_config = {
                        'agentId': f"participant_{participant_config['name'].lower()}",
                        'modelSettings': {
                            'model': 'gemini-1.5-flash',
                            'temperature': 0.8
                        },
                        'promptContext': f"You are {participant_config['name']}. {participant_config['description']}"
                    }
                    
                    participant_id = create_participant_callable(
                        experiment['id'],
                        cohort_id,
                        agent_config
                    )
                    print(f"  ✓ Participant {i+1}/{group_size} added ({participant_config['name']})")
                
                results.append({
                    'geminiBehavior': behavior['name'],
                    'groupSize': group_size,
                    'experimentId': experiment['id'],
                    'cohortId': cohort_id,
                    'status': 'success'
                })
                
                print(f"  ✅ SUCCESS: {exp_label}")
                
                # Small delay to avoid rate limiting
                time.sleep(1)
                
            except Exception as e:
                error_msg = str(e)
                print(f"  ❌ ERROR: {exp_label} - {error_msg}")
                
                results.append({
                    'geminiBehavior': behavior['name'],
                    'groupSize': group_size,
                    'experimentId': 'N/A',
                    'cohortId': 'N/A',
                    'status': 'error',
                    'error': error_msg
                })
    
    print("\n" + "=" * 80)
    success_count = sum(1 for r in results if r['status'] == 'success')
    error_count = sum(1 for r in results if r['status'] == 'error')
    
    print(f"\n✅ Batch creation complete!")
    print(f"   Success: {success_count}/{total}")
    print(f"   Errors:  {error_count}/{total}")
    
    return results


# Run the batch creation
batch_results = create_batch_experiments(
    DELIBERATE_LAB_API_KEY,
    DELIBERATE_LAB_BASE_URL,
    selected_scenarios,
    GEMINI_AGENT_BEHAVIORS,
    chat_duration_minutes=10
)

# ==============================================================================
# CELL 8: Results Summary & Export
# ==============================================================================

# @title Results Summary and Export

import pandas as pd

# Create results dataframe
df_results = pd.DataFrame(batch_results)

# Display summary
print("\n📊 Results Summary:\n")
print(df_results[['geminiBehavior', 'groupSize', 'status', 'experimentId']].to_string(index=False))

# Save to JSON
results_json_path = '/tmp/batch_experiment_results.json'
with open(results_json_path, 'w') as f:
    json.dump(batch_results, f, indent=2)

print(f"\n💾 Results saved to: {results_json_path}")

# Save to CSV
results_csv_path = '/tmp/batch_experiment_results.csv'
df_results.to_csv(results_csv_path, index=False)
print(f"💾 Results saved to: {results_csv_path}")

# Download files
try:
    from google.colab import files
    files.download(results_json_path)
    files.download(results_csv_path)
    print("\n📥 Files ready for download!")
except ImportError:
    print("\n💡 Not in Colab - files saved locally")

# Display success rate by group size
print("\n📈 Success Rate by Group Size:")
success_by_size = df_results.groupby('groupSize')['status'].apply(
    lambda x: f"{sum(x == 'success')}/{len(x)}"
)
print(success_by_size)

# Display success rate by Gemini agent behavior
print("\n📈 Success Rate by Gemini Agent Behavior:")
success_by_behavior = df_results.groupby('geminiBehavior')['status'].apply(
    lambda x: f"{sum(x == 'success')}/{len(x)}"
)
print(success_by_behavior)

print("\n✨ All done!")

#!/usr/bin/env python3
"""
Add OCEAN personality scores AND Voice Cards to scenarios

Voice Card attributes:
- Avg words/turn
- Turn-taking style (interrupt vs wait)
- Hedging/certainty level
- Register (casual/formal)
- Discourse markers
- Backchannels
- Question rate
- Emotion display
- Repair style
- Lexical constraints (catchphrases, words they avoid)
- Structure (lists/stories/analogies/bottom lines)
- Voice examples
"""

import re
import random
from typing import List, Dict
import json

random.seed(42)

# ============================================================================
# VOICE CARD GENERATION
# ============================================================================

DISCOURSE_MARKERS = {
    "casual": ["like", "you know", "I mean", "so", "basically", "honestly", "right", "okay so", "anyway", "kinda"],
    "formal": ["essentially", "in other words", "to be clear", "that said", "in fact", "moreover", "however"],
    "filler": ["um", "uh", "well", "look", "see", "thing is"],
    "agreement": ["totally", "exactly", "absolutely", "for sure", "hundred percent"],
    "transition": ["anyway", "so anyway", "moving on", "but yeah", "okay but"]
}

BACKCHANNELS = {
    "enthusiastic": ["yeah!", "totally!", "oh for sure", "love that", "yes yes yes"],
    "casual": ["yeah", "uh-huh", "mm-hmm", "right", "sure"],
    "minimal": ["mm", "hm", "okay", "got it"],
    "formal": ["I see", "understood", "noted", "interesting", "fair enough"]
}

CATCHPHRASES = [
    "at the end of the day", "bottom line", "here's the thing", "real talk",
    "no but seriously", "I'm just saying", "if you ask me", "that's the move",
    "you know what I mean", "fair point", "can't argue with that", "makes sense",
    "classic", "iconic", "low-key", "high-key", "vibe check", "that tracks",
    "I hear you", "let's be real", "what if we", "I could be wrong but",
    "honestly though", "it is what it is", "let's just", "I'm into it"
]

AVOID_WORDS = [
    "actually", "literally", "basically", "honestly", "frankly", "obviously",
    "definitely", "absolutely", "totally", "super", "really", "very",
    "like", "um", "uh", "whatever", "stuff", "things", "nice", "good"
]

def generate_voice_card(name: str, ocean: Dict, description: str) -> Dict:
    """Generate a unique voice card based on OCEAN personality and description."""
    
    desc_lower = description.lower()
    
    # Base tendencies from OCEAN
    is_extraverted = ocean.get('E', 5) >= 6
    is_agreeable = ocean.get('A', 5) >= 6
    is_neurotic = ocean.get('N', 5) >= 6
    is_conscientious = ocean.get('C', 5) >= 6
    is_open = ocean.get('O', 5) >= 6
    
    # 1. Words per turn (8-25 range)
    if is_extraverted:
        words_per_turn = random.randint(15, 25)
    elif ocean.get('E', 5) <= 3:
        words_per_turn = random.randint(8, 15)
    else:
        words_per_turn = random.randint(10, 20)
    
    # 2. Turn-taking style
    if is_extraverted and not is_agreeable:
        turn_taking = random.choice(["jumps in quickly", "sometimes interrupts", "eager to contribute"])
    elif is_agreeable or ocean.get('E', 5) <= 3:
        turn_taking = random.choice(["waits for others to finish", "lets others speak first", "politely waits their turn"])
    else:
        turn_taking = random.choice(["takes natural pauses", "balanced turn-taking", "responds when addressed"])
    
    # 3. Hedging/certainty level
    if is_neurotic or is_agreeable:
        hedging = random.choice(["high hedging", "often softens claims"])
        hedging_examples = random.sample(["maybe", "I think", "sort of", "I guess", "probably", "it seems like", "I could be wrong but"], 3)
    elif is_conscientious or not is_agreeable:
        hedging = random.choice(["low hedging", "speaks with certainty"])
        hedging_examples = random.sample(["here's what we'll do", "the answer is", "clearly", "obviously", "we should"], 3)
    else:
        hedging = "moderate hedging"
        hedging_examples = random.sample(["I think", "probably", "it seems", "might be"], 2)
    
    # 4. Register (casual/formal)
    if any(w in desc_lower for w in ["young", "trendy", "teenager", "student", "junior", "social"]):
        register = "very casual"
        uses_contractions = True
        uses_slang = True
    elif any(w in desc_lower for w in ["manager", "lead", "senior", "professional", "executive", "ceo", "vp"]):
        register = random.choice(["professional", "moderately formal"])
        uses_contractions = random.choice([True, False])
        uses_slang = False
    else:
        register = random.choice(["casual", "conversational"])
        uses_contractions = True
        uses_slang = random.choice([True, False])
    
    # 5. Discourse markers (pick 3-5 based on register)
    if register in ["very casual", "casual"]:
        markers = random.sample(DISCOURSE_MARKERS["casual"] + DISCOURSE_MARKERS["filler"], random.randint(3, 5))
    elif register in ["professional", "moderately formal"]:
        markers = random.sample(DISCOURSE_MARKERS["formal"] + ["well", "so"], random.randint(2, 4))
    else:
        markers = random.sample(DISCOURSE_MARKERS["casual"][:5] + DISCOURSE_MARKERS["formal"][:3], random.randint(3, 4))
    
    # 6. Backchannels
    if is_enthusiastic := (is_extraverted and is_agreeable):
        backchannel_style = "enthusiastic"
    elif register in ["professional", "moderately formal"]:
        backchannel_style = "formal"
    elif ocean.get('E', 5) <= 3:
        backchannel_style = "minimal"
    else:
        backchannel_style = "casual"
    backchannels = random.sample(BACKCHANNELS[backchannel_style], min(3, len(BACKCHANNELS[backchannel_style])))
    
    # 7. Question rate
    if any(w in desc_lower for w in ["curious", "clarifying", "asks", "questioning"]) or is_open:
        question_rate = "asks many questions"
    elif is_conscientious and not is_open:
        question_rate = "prefers statements"
    else:
        question_rate = random.choice(["balanced questions and statements", "occasional questions"])
    
    # 8. Emotion display
    if is_neurotic:
        emotion_display = random.choice(["names feelings openly", "shows stress/worry", "expresses concern"])
        energy = random.choice(["anxious energy", "nervous", "high-strung"])
    elif is_extraverted:
        emotion_display = random.choice(["enthusiastic", "expressive", "shows excitement"])
        energy = random.choice(["high energy", "upbeat", "animated"])
    else:
        emotion_display = random.choice(["keeps it pragmatic", "emotionally neutral", "matter-of-fact"])
        energy = random.choice(["calm", "steady", "relaxed"])
    
    # 9. Repair style
    if is_neurotic:
        repair_style = random.choice(["self-corrects often", "restarts sentences", "trails off sometimes"])
    elif is_conscientious:
        repair_style = random.choice(["rarely needs to correct", "precise speech", "thinks before speaking"])
    else:
        repair_style = random.choice(["occasional restarts", "natural repairs", "self-corrects casually"])
    
    # 10. Lexical constraints
    catchphrases = random.sample(CATCHPHRASES, 2)
    never_uses = random.sample(AVOID_WORDS, 3)
    
    # 11. Structure
    if is_conscientious:
        structure = random.choice(["speaks in organized points", "uses lists", "structured thoughts"])
    elif is_open:
        structure = random.choice(["uses analogies", "tells quick stories", "makes connections"])
    elif is_extraverted:
        structure = random.choice(["stream of consciousness", "associative leaps", "tangential"])
    else:
        structure = random.choice(["gets to the point", "bottom-line focused", "concise"])
    
    # 12. Generate voice examples based on the card
    voice_examples = generate_voice_examples(markers, backchannels, hedging_examples, catchphrases, register, repair_style)
    
    return {
        "words_per_turn": f"{words_per_turn-5}-{words_per_turn+5}",
        "turn_taking": turn_taking,
        "hedging": hedging,
        "hedging_phrases": hedging_examples,
        "register": register,
        "uses_contractions": uses_contractions,
        "discourse_markers": markers,
        "backchannels": backchannels,
        "question_rate": question_rate,
        "emotion_display": emotion_display,
        "energy": energy,
        "repair_style": repair_style,
        "catchphrases": catchphrases,
        "never_uses": never_uses,
        "structure": structure,
        "voice_examples": voice_examples
    }

def generate_voice_examples(markers, backchannels, hedging, catchphrases, register, repair_style) -> List[str]:
    """Generate 3 example utterances that demonstrate this voice."""
    examples = []
    
    # Example 1: Using discourse marker + hedging
    marker = random.choice(markers) if markers else "well"
    hedge = random.choice(hedging) if hedging else "I think"
    if register == "very casual":
        examples.append(f"{marker.capitalize()}, {hedge} that could work for everyone?")
    else:
        examples.append(f"{marker.capitalize()}, {hedge} we should consider that option.")
    
    # Example 2: Using backchannel + catchphrase
    backchannel = random.choice(backchannels) if backchannels else "yeah"
    catch = random.choice(catchphrases) if catchphrases else ""
    if catch:
        examples.append(f"{backchannel.capitalize()}... {catch}, that's exactly it.")
    else:
        examples.append(f"{backchannel.capitalize()}, I'm on board with that.")
    
    # Example 3: Based on repair style
    if "restarts" in repair_style or "trails off" in repair_style:
        examples.append("Wait, sorry—let me rephrase that...")
    elif "self-corrects" in repair_style:
        examples.append("I mean—no, actually, what I meant was...")
    else:
        examples.append("That sounds good to me.")
    
    return examples

def format_voice_card_prompt(vc: Dict) -> str:
    """Format voice card as prompt instructions."""
    return f"""VOICE CARD (follow strictly):
- Words per turn: {vc['words_per_turn']} words
- Turn-taking: {vc['turn_taking']}
- Hedging: {vc['hedging']} (use: "{', '.join(vc['hedging_phrases'])}")
- Register: {vc['register']}, {"uses contractions" if vc['uses_contractions'] else "avoids contractions"}
- Discourse markers (use often): {', '.join(f'"{m}"' for m in vc['discourse_markers'])}
- Backchannels: {', '.join(f'"{b}"' for b in vc['backchannels'])}
- Questions: {vc['question_rate']}
- Emotion: {vc['emotion_display']}, {vc['energy']}
- Repair style: {vc['repair_style']}
- Catchphrases: {', '.join(f'"{c}"' for c in vc['catchphrases'])}
- NEVER use these words: {', '.join(vc['never_uses'])}
- Structure: {vc['structure']}

VOICE EXAMPLES (match this style):
{chr(10).join(f'  "{ex}"' for ex in vc['voice_examples'])}"""

# ============================================================================
# OCEAN PERSONALITY GENERATION
# ============================================================================

def get_personality_for_description(name: str, description: str) -> Dict:
    """Generate personality scores based on keywords in description."""
    desc_lower = description.lower()
    
    O, C, E, A, N = 5, 5, 5, 5, 5
    
    if any(w in desc_lower for w in ['adventurous', 'creative', 'innovative', 'new', 'explore', 'unique', 'trendy', 'curious']):
        O = random.randint(7, 10)
    elif any(w in desc_lower for w in ['traditional', 'familiar', 'classic', 'conventional', 'proven']):
        O = random.randint(2, 5)
    else:
        O = random.randint(4, 7)
    
    if any(w in desc_lower for w in ['organized', 'budget', 'responsible', 'planner', 'meticulous', 'manager', 'lead']):
        C = random.randint(7, 10)
    elif any(w in desc_lower for w in ['impulsive', 'spontaneous', 'indecisive', 'careless']):
        C = random.randint(2, 5)
    else:
        C = random.randint(4, 7)
    
    if any(w in desc_lower for w in ['enthusiastic', 'social', 'outgoing', 'lively', 'vibrant', 'bold', 'energetic']):
        E = random.randint(7, 10)
    elif any(w in desc_lower for w in ['shy', 'quiet', 'reserved', 'introverted', 'private']):
        E = random.randint(2, 5)
    else:
        E = random.randint(4, 7)
    
    if any(w in desc_lower for w in ['accommodating', 'agreeable', 'easygoing', 'friendly', 'cooperative', 'compromise']):
        A = random.randint(7, 10)
    elif any(w in desc_lower for w in ['critical', 'competitive', 'dismissive', 'strong opinions']):
        A = random.randint(2, 5)
    else:
        A = random.randint(4, 7)
    
    if any(w in desc_lower for w in ['worried', 'anxious', 'stressed', 'concerned', 'nervous', 'overwhelmed']):
        N = random.randint(6, 9)
    elif any(w in desc_lower for w in ['confident', 'relaxed', 'calm', 'easy-going', 'laid-back']):
        N = random.randint(2, 4)
    else:
        N = random.randint(3, 6)
    
    # Add randomness
    O = max(1, min(10, O + random.randint(-1, 1)))
    C = max(1, min(10, C + random.randint(-1, 1)))
    E = max(1, min(10, E + random.randint(-1, 1)))
    A = max(1, min(10, A + random.randint(-1, 1)))
    N = max(1, min(10, N + random.randint(-1, 1)))
    
    return {"O": O, "C": C, "E": E, "A": A, "N": N}

# ============================================================================
# MAIN PROCESSING
# ============================================================================

def update_scenarios_json(html_path: str, json_path: str):
    """Parse HTML and create scenarios.json with OCEAN and Voice Cards."""
    
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    scenarios = []
    row_pattern = r'<tr>\s*<td>([^<]+)</td>\s*<td>([^<]+)</td>\s*<td>(.+?)</td>\s*<td>([^<]+)</td>\s*</tr>'
    
    for match in re.finditer(row_pattern, content, re.DOTALL):
        scenario_type = match.group(1).strip()
        scenario_desc = match.group(2).strip()
        participants_html = match.group(3).strip()
        
        if scenario_type == 'scenario_type':
            continue
        
        participants = []
        participant_pattern = r'<b>([^<]+)</b>(?:\s*\[OCEAN:[^\]]+\])?\s*:\s*(.+?)(?=<br><br><b>|$)'
        
        for p_match in re.finditer(participant_pattern, participants_html, re.DOTALL):
            name = p_match.group(1).strip()
            description = p_match.group(2).strip()
            
            ocean = get_personality_for_description(name, description)
            voice_card = generate_voice_card(name, ocean, description)
            
            participants.append({
                "name": name,
                "description": description,
                "ocean": ocean,
                "voice_card": voice_card
            })
        
        if participants:
            scenarios.append({
                "scenario_type": scenario_type,
                "scenario": scenario_desc,
                "participants": participants,
                "participant_count": len(participants)
            })
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(scenarios, f, indent=2)
    
    print(f"✅ Updated {json_path} with {len(scenarios)} scenarios")
    
    # Print sample
    if scenarios:
        sample = scenarios[3]  # Get one with multiple participants
        print(f"\n📊 Sample (Scenario: {sample['scenario_type'][:40]}...):")
        for p in sample['participants'][:2]:
            print(f"\n  {p['name']}:")
            print(f"    OCEAN: O={p['ocean']['O']} C={p['ocean']['C']} E={p['ocean']['E']} A={p['ocean']['A']} N={p['ocean']['N']}")
            vc = p['voice_card']
            print(f"    Voice: {vc['words_per_turn']} words, {vc['turn_taking']}, {vc['register']}")
            print(f"    Markers: {', '.join(vc['discourse_markers'][:3])}")
            print(f"    Examples: \"{vc['voice_examples'][0]}\"")

if __name__ == "__main__":
    input_html = "/Users/hallak/Downloads/scenarios_table.html"
    output_json = "/Users/hallak/Documents/deliberate-lab/deliberate-lab/scripts/scenarios.json"
    update_scenarios_json(input_html, output_json)

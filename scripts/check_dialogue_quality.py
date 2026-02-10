#!/usr/bin/env python3
"""
Dialogue Quality Checker

Analyzes dialogue files for common quality issues:
1. Excessive filler word usage
2. Echo-repeating patterns (starting with what previous speaker said)
3. Hollow acknowledgments from Gemini
4. Repetitive sentence starters

Usage:
    python check_dialogue_quality.py <dialogue_file.txt>
"""

import argparse
import re
from collections import Counter, defaultdict
from pathlib import Path


# Patterns that indicate quality issues
FILLER_PATTERNS = [
    r"\byou know\b",
    r"\bI mean\b",
    r"\bbasically\b",
    r"\bessentially\b",
    r"\bperhaps\b",
    r"\bI guess\b",
    r"\bI think\b",
    r"\bkinda\b",
    r"\blike,\b",  # filler "like" with comma
    r"\bum\b",
    r"\buh\b",
]

HOLLOW_GEMINI_PATTERNS = [
    r"(That|This) sounds (like a )?good( option)?",
    r"(That|This) sounds (very )?practical",
    r"(That|This) sounds (like a )?great( idea)?",
    r"Yes,? I agree\.?$",
    r"^(Yes|Yeah),? that('s| is) (a )?(good|great|excellent) (point|idea|suggestion)",
    r"^Good (point|idea|suggestion)",
    r"^That's (a )?(very )?(good|great|excellent|valid|fair) (point|idea|concern)",
]

# Common repetitive starters
REPETITIVE_STARTERS = [
    r"^So,",
    r"^Yeah,",
    r"^Yes,",
    r"^Well,",
    r"^Okay,",
    r"^I think",
    r"^Perhaps",
]


def parse_dialogue_file(filepath: Path) -> list[dict]:
    """Parse dialogue file into structured messages."""
    messages = []
    current_experiment = None
    
    with open(filepath, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
                
            # Track experiment sections
            if line.startswith("=== "):
                current_experiment = line
                continue
            
            if line.startswith("Experiment ID:"):
                continue
            
            # Skip system messages
            if line.startswith("System:"):
                continue
            
            # Parse speaker: message format
            if ": " in line:
                parts = line.split(": ", 1)
                if len(parts) == 2:
                    speaker = parts[0].strip()
                    message = parts[1].strip()
                    messages.append({
                        "line_num": line_num,
                        "speaker": speaker,
                        "message": message,
                        "experiment": current_experiment,
                    })
    
    return messages


def check_filler_overuse(messages: list[dict]) -> dict:
    """Check for excessive filler word usage per speaker."""
    speaker_fillers = defaultdict(lambda: defaultdict(int))
    speaker_message_counts = defaultdict(int)
    issues = []
    
    for msg in messages:
        speaker = msg["speaker"]
        text = msg["message"]
        speaker_message_counts[speaker] += 1
        
        for pattern in FILLER_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                speaker_fillers[speaker][pattern] += len(matches)
    
    # Calculate filler density per speaker
    filler_density = {}
    for speaker, fillers in speaker_fillers.items():
        total_fillers = sum(fillers.values())
        msg_count = speaker_message_counts[speaker]
        density = total_fillers / msg_count if msg_count > 0 else 0
        filler_density[speaker] = {
            "total_fillers": total_fillers,
            "messages": msg_count,
            "density": round(density, 2),
            "breakdown": dict(fillers),
        }
        
        if density > 1.0:  # More than 1 filler per message on average
            issues.append(f"Speaker '{speaker}' has high filler density: {density:.2f} per message")
    
    return {"filler_density": filler_density, "issues": issues}


def check_echo_repeating(messages: list[dict]) -> list[dict]:
    """Check for echo-repeating patterns where speaker repeats previous speaker's words."""
    issues = []
    
    for i in range(1, len(messages)):
        prev_msg = messages[i - 1]
        curr_msg = messages[i]
        
        # Skip if same speaker
        if prev_msg["speaker"] == curr_msg["speaker"]:
            continue
        
        # Get first 5 significant words of current message
        curr_words = re.findall(r'\b\w+\b', curr_msg["message"].lower())[:8]
        prev_words = set(re.findall(r'\b\w+\b', prev_msg["message"].lower()))
        
        # Skip common words
        skip_words = {"the", "a", "an", "is", "are", "was", "were", "to", "for", "and", "or", "but", "so", "yes", "yeah", "okay", "ok", "that", "this", "it", "i", "we", "you", "they"}
        
        # Count overlap
        overlap = [w for w in curr_words if w in prev_words and w not in skip_words]
        
        if len(overlap) >= 3:
            issues.append({
                "line_num": curr_msg["line_num"],
                "speaker": curr_msg["speaker"],
                "message": curr_msg["message"][:80] + "...",
                "echoed_words": overlap,
                "prev_speaker": prev_msg["speaker"],
            })
    
    return issues


def check_hollow_gemini(messages: list[dict]) -> list[dict]:
    """Check for hollow acknowledgment patterns from Gemini."""
    issues = []
    
    for msg in messages:
        if "Gemini" not in msg["speaker"]:
            continue
        
        text = msg["message"]
        
        for pattern in HOLLOW_GEMINI_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                issues.append({
                    "line_num": msg["line_num"],
                    "message": text[:100] + ("..." if len(text) > 100 else ""),
                    "pattern": pattern,
                })
                break  # Only report once per message
    
    return issues


def check_repetitive_starters(messages: list[dict]) -> dict:
    """Check for repetitive sentence starters per speaker."""
    speaker_starters = defaultdict(Counter)
    
    for msg in messages:
        speaker = msg["speaker"]
        text = msg["message"]
        
        for pattern in REPETITIVE_STARTERS:
            if re.match(pattern, text, re.IGNORECASE):
                speaker_starters[speaker][pattern] += 1
                break
    
    issues = []
    for speaker, starters in speaker_starters.items():
        for pattern, count in starters.items():
            if count >= 3:
                issues.append(f"Speaker '{speaker}' starts with '{pattern}' {count} times")
    
    return {"starters_by_speaker": dict(speaker_starters), "issues": issues}


def generate_report(filepath: Path, messages: list[dict]) -> str:
    """Generate a quality report for the dialogue file."""
    report = []
    report.append(f"=" * 60)
    report.append(f"DIALOGUE QUALITY REPORT")
    report.append(f"File: {filepath.name}")
    report.append(f"Total messages analyzed: {len(messages)}")
    report.append(f"=" * 60)
    
    # Filler analysis
    filler_results = check_filler_overuse(messages)
    report.append("\n## FILLER WORD ANALYSIS")
    report.append("-" * 40)
    
    for speaker, data in sorted(filler_results["filler_density"].items(), 
                                 key=lambda x: x[1]["density"], reverse=True):
        if data["density"] > 0.3:
            report.append(f"  {speaker}: {data['density']:.2f} fillers/message ({data['total_fillers']} total in {data['messages']} msgs)")
    
    if filler_results["issues"]:
        report.append("\n  ⚠️  HIGH FILLER DENSITY WARNINGS:")
        for issue in filler_results["issues"]:
            report.append(f"    - {issue}")
    
    # Echo-repeating analysis
    echo_issues = check_echo_repeating(messages)
    report.append("\n## ECHO-REPEATING PATTERNS")
    report.append("-" * 40)
    report.append(f"  Found {len(echo_issues)} instances of echo-repeating")
    
    if echo_issues[:5]:  # Show first 5
        for issue in echo_issues[:5]:
            report.append(f"  Line {issue['line_num']}: {issue['speaker']} echoed {issue['echoed_words']}")
    
    # Hollow Gemini responses
    hollow_issues = check_hollow_gemini(messages)
    report.append("\n## HOLLOW GEMINI RESPONSES")
    report.append("-" * 40)
    report.append(f"  Found {len(hollow_issues)} hollow acknowledgments")
    
    if hollow_issues[:5]:  # Show first 5
        for issue in hollow_issues[:5]:
            report.append(f"  Line {issue['line_num']}: \"{issue['message']}\"")
    
    # Repetitive starters
    starter_results = check_repetitive_starters(messages)
    report.append("\n## REPETITIVE SENTENCE STARTERS")
    report.append("-" * 40)
    
    if starter_results["issues"]:
        for issue in starter_results["issues"]:
            report.append(f"  - {issue}")
    else:
        report.append("  No significant repetition detected")
    
    # Summary
    total_issues = (
        len(filler_results["issues"]) + 
        len(echo_issues) + 
        len(hollow_issues) + 
        len(starter_results["issues"])
    )
    
    report.append("\n" + "=" * 60)
    report.append(f"SUMMARY: {total_issues} total quality issues detected")
    report.append("=" * 60)
    
    return "\n".join(report)


def main():
    parser = argparse.ArgumentParser(description="Check dialogue quality")
    parser.add_argument("filepath", type=Path, help="Path to dialogue file")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()
    
    if not args.filepath.exists():
        print(f"Error: File not found: {args.filepath}")
        return 1
    
    messages = parse_dialogue_file(args.filepath)
    
    if not messages:
        print("No messages found in file")
        return 1
    
    report = generate_report(args.filepath, messages)
    print(report)
    
    return 0


if __name__ == "__main__":
    exit(main())

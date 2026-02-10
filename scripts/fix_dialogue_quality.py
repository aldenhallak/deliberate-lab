#!/usr/bin/env python3
"""
Dialogue Quality Fixer

Post-processes dialogue files to fix common quality issues:
1. Reduces excessive filler word usage
2. Flags echo-repeating patterns
3. Flags hollow Gemini acknowledgments

Usage:
    python fix_dialogue_quality.py <dialogue_file.txt> --output <fixed_file.txt>
"""

import argparse
import re
from pathlib import Path


# Filler patterns to reduce (not eliminate completely)
FILLER_PATTERNS = [
    (r",?\s*you know\??\s*", ", "),  # "you know" -> comma
    (r",?\s*you know,\s*", ", "),
    (r"\bI mean,?\s*", ""),  # "I mean" -> remove
    (r"\bbasically,?\s*", ""),  # "basically" -> remove
    (r"\bessentially,?\s*", ""),  # "essentially" -> remove
    (r"\bI guess,?\s*", ""),  # "I guess" -> remove
    (r"\bperhaps\s+", "maybe "),  # "perhaps" -> "maybe"
    (r"\bkinda\s+", "kind of "),  # normalize
]

# Hollow patterns from Gemini to flag
HOLLOW_GEMINI_PATTERNS = [
    r"^(That|This) sounds (like a )?good( option)?\.?$",
    r"^(That|This) sounds (very )?practical\.?$",
    r"^Yes,? I agree\.?$",
    r"^(Yes|Yeah),? that('s| is) (a )?(good|great) (point|idea)\.?$",
]


def fix_excessive_fillers(text: str, is_first_in_block: bool) -> str:
    """Reduce filler words but keep some for naturalness."""
    result = text
    
    # Count current fillers
    filler_count = 0
    for pattern, _ in FILLER_PATTERNS:
        filler_count += len(re.findall(pattern, result, re.IGNORECASE))
    
    # Only fix if more than 1 filler in the line
    if filler_count <= 1:
        return result
    
    # Remove fillers, keeping at most 1
    removed = 0
    for pattern, replacement in FILLER_PATTERNS:
        matches = list(re.finditer(pattern, result, re.IGNORECASE))
        if matches and removed < filler_count - 1:
            # Remove first occurrence
            match = matches[0]
            result = result[:match.start()] + replacement + result[match.end():]
            removed += 1
    
    # Clean up double spaces and weird punctuation
    result = re.sub(r'\s+', ' ', result)
    result = re.sub(r',\s*,', ',', result)
    result = re.sub(r'\.\s*,', '.', result)
    result = re.sub(r'^\s*,\s*', '', result)
    
    return result.strip()


def detect_echo_pattern(prev_message: str, curr_message: str) -> bool:
    """Check if current message starts by echoing the previous one."""
    if not prev_message or not curr_message:
        return False
    
    # Get significant words from both
    skip_words = {"the", "a", "an", "is", "are", "was", "were", "to", "for", "and", 
                  "or", "but", "so", "yes", "yeah", "okay", "ok", "that", "this", 
                  "it", "i", "we", "you", "they", "sounds", "good", "like"}
    
    prev_words = set(re.findall(r'\b\w+\b', prev_message.lower())) - skip_words
    curr_start_words = re.findall(r'\b\w+\b', curr_message.lower())[:6]
    
    overlap = [w for w in curr_start_words if w in prev_words]
    
    return len(overlap) >= 3


def is_hollow_gemini_response(text: str) -> bool:
    """Check if this is a hollow Gemini acknowledgment."""
    for pattern in HOLLOW_GEMINI_PATTERNS:
        if re.match(pattern, text.strip(), re.IGNORECASE):
            return True
    return False


def process_dialogue_file(input_path: Path, output_path: Path, flag_only: bool = False) -> dict:
    """Process a dialogue file and fix/flag quality issues."""
    stats = {
        "lines_processed": 0,
        "fillers_reduced": 0,
        "echo_patterns_flagged": 0,
        "hollow_responses_flagged": 0,
    }
    
    output_lines = []
    prev_message = ""
    prev_speaker = ""
    
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    for line in lines:
        original_line = line.rstrip('\n')
        stats["lines_processed"] += 1
        
        # Pass through non-dialogue lines unchanged
        if not original_line.strip() or original_line.startswith("===") or \
           original_line.startswith("Experiment ID:") or original_line.startswith("System:"):
            output_lines.append(original_line)
            prev_message = ""
            prev_speaker = ""
            continue
        
        # Parse speaker: message
        if ": " not in original_line:
            output_lines.append(original_line)
            continue
        
        parts = original_line.split(": ", 1)
        if len(parts) != 2:
            output_lines.append(original_line)
            continue
        
        speaker = parts[0]
        message = parts[1]
        modified_message = message
        flags = []
        
        # Fix excessive fillers
        fixed_message = fix_excessive_fillers(message, prev_speaker != speaker)
        if fixed_message != message:
            stats["fillers_reduced"] += 1
            if not flag_only:
                modified_message = fixed_message
        
        # Check for echo patterns
        if prev_speaker and prev_speaker != speaker:
            if detect_echo_pattern(prev_message, message):
                stats["echo_patterns_flagged"] += 1
                flags.append("[ECHO]")
        
        # Check for hollow Gemini responses
        if "Gemini" in speaker and is_hollow_gemini_response(message):
            stats["hollow_responses_flagged"] += 1
            flags.append("[HOLLOW]")
        
        # Build output line
        if flags and flag_only:
            output_lines.append(f"{' '.join(flags)} {speaker}: {modified_message}")
        else:
            output_lines.append(f"{speaker}: {modified_message}")
        
        prev_message = message
        prev_speaker = speaker
    
    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_lines) + '\n')
    
    return stats


def main():
    parser = argparse.ArgumentParser(description="Fix dialogue quality issues")
    parser.add_argument("filepath", type=Path, help="Path to dialogue file")
    parser.add_argument("--output", "-o", type=Path, required=True, 
                        help="Output path for fixed file")
    parser.add_argument("--flag-only", action="store_true",
                        help="Only flag issues, don't fix them")
    args = parser.parse_args()
    
    if not args.filepath.exists():
        print(f"Error: File not found: {args.filepath}")
        return 1
    
    stats = process_dialogue_file(args.filepath, args.output, args.flag_only)
    
    print(f"Processed {stats['lines_processed']} lines")
    print(f"  - Fillers reduced: {stats['fillers_reduced']}")
    print(f"  - Echo patterns flagged: {stats['echo_patterns_flagged']}")
    print(f"  - Hollow responses flagged: {stats['hollow_responses_flagged']}")
    print(f"\nOutput written to: {args.output}")
    
    return 0


if __name__ == "__main__":
    exit(main())

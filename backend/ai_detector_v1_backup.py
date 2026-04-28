import re
import math
import time
import statistics
from collections import Counter

import torch
from transformers import GPT2LMHeadModel, GPT2TokenizerFast

# ── Model ─────────────────────────────────────────────────────────────────────
print("[ai_detector] Loading GPT-2 model...")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_tokenizer = GPT2TokenizerFast.from_pretrained("gpt2")
_model = GPT2LMHeadModel.from_pretrained("gpt2").to(DEVICE)
_model.eval()
print(f"[ai_detector] GPT-2 loaded on {DEVICE}.")

MAX_TOKENS = 512

# ── AI transition/filler phrases — strong AI signal ──────────────────────────
# These are phrases that appear disproportionately in LLM output
AI_PHRASES = [
    "furthermore", "moreover", "in conclusion", "it is important to note",
    "it is worth noting", "it should be noted", "in summary", "to summarize",
    "in addition", "additionally", "consequently", "as a result",
    "it is essential", "plays a crucial role", "plays a vital role",
    "it is crucial", "it is vital", "overall", "in today's world",
    "in the modern era", "in recent years", "needless to say",
    "first and foremost", "last but not least", "without a doubt",
    "it goes without saying", "as mentioned earlier", "as previously stated",
    "delve into", "dive into", "at its core", "in the realm of",
    "the importance of", "a wide range of", "a variety of",
    "various aspects", "key aspects", "key factors", "key elements",
    "significant impact", "profound impact", "transformative impact",
    "shed light on", "it is imperative", "one must consider",
    "on the other hand", "on the contrary", "to put it simply",
    "in other words", "that being said", "with that said",
]

# ── Feature 1: Perplexity ─────────────────────────────────────────────────────

def calculate_perplexity(text: str) -> float:
    """
    GPT-2 perplexity. IMPORTANT: thresholds are not intuitive.
    
    GPT-2 (2019) finds modern AI text (GPT-4, Claude) relatively HIGH perplexity
    because those models use more diverse vocabulary and longer sentences than
    GPT-2's training distribution. So the calibration is:
    
    Very low  (<30):  Clearly matches GPT-2's style → likely older AI or GPT-2 itself
    Low       (30-80): Smooth, predictable → likely AI (GPT-3.5+)  
    Medium   (80-150): Could be either
    High     (150-250): Varies more → lean human
    Very high (>250): Very unpredictable → likely human (casual/informal writing)
    
    Note: Academic human writing often has perplexity 80-200.
    Modern AI writing (GPT-4) often sits at 40-120.
    """
    encodings = _tokenizer(
        text, return_tensors="pt", truncation=True, max_length=MAX_TOKENS
    )
    input_ids = encodings.input_ids.to(DEVICE)

    if input_ids.shape[1] < 2:
        return 999.0

    with torch.no_grad():
        outputs = _model(input_ids, labels=input_ids)
        loss = outputs.loss

    return round(torch.exp(loss).item(), 2)

# ── Feature 2: Burstiness ─────────────────────────────────────────────────────

def calculate_burstiness(text: str) -> float:
    """
    Variance in sentence length. AI = uniform, Human = irregular.
    Returns coefficient of variation (0-1+). Higher = more human-like.
    """
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s for s in sentences if len(s.strip()) > 5]

    if len(sentences) < 3:
        return 0.5

    lengths = [len(s.split()) for s in sentences]
    mean = statistics.mean(lengths)
    std = statistics.stdev(lengths) if len(lengths) > 1 else 0

    if mean == 0:
        return 0.0

    return round(min(std / mean, 1.0), 4)

# ── Feature 3: Token Entropy ──────────────────────────────────────────────────

def calculate_entropy(text: str) -> float:
    words = re.findall(r'\b\w+\b', text.lower())
    if not words:
        return 0.0
    counts = Counter(words)
    total = len(words)
    return round(-sum((c / total) * math.log2(c / total) for c in counts.values()), 4)

# ── Feature 4: Stylometry ─────────────────────────────────────────────────────

def calculate_stylometry(text: str) -> dict:
    words = re.findall(r'\b\w+\b', text)
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s for s in sentences if s.strip()]

    total_words = len(words)
    total_sentences = len(sentences)

    if total_words == 0:
        return {"avg_word_length": 0, "punctuation_density": 0,
                "unique_word_ratio": 0, "avg_sentence_length": 0}

    return {
        "avg_word_length": round(sum(len(w) for w in words) / total_words, 2),
        "punctuation_density": round(
            sum(1 for c in text if c in '.,;:!?-()[]{}"\'"') / len(text), 4
        ),
        "unique_word_ratio": round(
            len(set(w.lower() for w in words)) / total_words, 4
        ),
        "avg_sentence_length": round(total_words / total_sentences, 2) if total_sentences else 0,
    }

# ── Feature 5: AI Phrase Detection ───────────────────────────────────────────

def calculate_ai_phrase_score(text: str) -> tuple[float, list[str]]:
    """
    Counts known AI filler/transition phrases.
    Returns (density_score 0-1, list of found phrases).
    """
    text_lower = text.lower()
    found = [p for p in AI_PHRASES if p in text_lower]
    words = len(text.split())
    # Normalize: phrases per 100 words
    density = len(found) / max(words / 100, 1)
    # Score: 0-1 where >3 phrases/100 words = very AI-like
    score = min(density / 3.0, 1.0)
    return round(score, 4), found

# ── Feature 6: Repetition / Structural Uniformity ────────────────────────────

def calculate_structural_uniformity(text: str) -> float:
    """
    AI text often has very uniform paragraph lengths and parallel structure.
    Measures std deviation of paragraph lengths — lower = more AI-like.
    Returns 0-1 where 0 = very uniform (AI-like), 1 = very varied (human-like).
    """
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    if len(paragraphs) < 2:
        # No paragraph structure — fall back to sentence uniformity
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        sentences = [s for s in sentences if len(s.strip()) > 5]
        if len(sentences) < 3:
            return 0.5
        lengths = [len(s.split()) for s in sentences]
    else:
        lengths = [len(p.split()) for p in paragraphs]

    mean = statistics.mean(lengths)
    std = statistics.stdev(lengths) if len(lengths) > 1 else 0
    if mean == 0:
        return 0.5
    cv = std / mean
    return round(min(cv, 1.0), 4)

# ── Scoring ───────────────────────────────────────────────────────────────────

def compute_ai_probability(
    perplexity: float,
    burstiness: float,
    entropy: float,
    style: dict,
    ai_phrase_score: float,
    ai_phrases_found: list,
    structural_uniformity: float,
) -> dict:
    signals = []
    reasoning = []

    # ── 1. Perplexity (20% weight) ──
    # Recalibrated: GPT-2 perplexity on modern AI text is typically 40-120
    # Human casual writing is 150-400+, academic writing 80-200
    if perplexity < 40:
        ppl_score = 85
        reasoning.append(f"Very low GPT-2 perplexity ({perplexity}) — highly predictable text pattern, strongly AI-like.")
    elif perplexity < 80:
        ppl_score = 70
        reasoning.append(f"Low perplexity ({perplexity}) — smooth, predictable writing typical of AI models.")
    elif perplexity < 150:
        ppl_score = 45
        reasoning.append(f"Medium perplexity ({perplexity}) — could be polished human writing or AI-generated.")
    elif perplexity < 250:
        ppl_score = 25
        reasoning.append(f"High perplexity ({perplexity}) — varied vocabulary and structure, more human-like.")
    else:
        ppl_score = 10
        reasoning.append(f"Very high perplexity ({perplexity}) — highly irregular, strongly suggests human writing.")
    signals.append(("perplexity", ppl_score, 0.20))

    # ── 2. Burstiness (20% weight) ──
    if burstiness < 0.15:
        bst_score = 85
        reasoning.append(f"Very uniform sentence lengths (burstiness={burstiness}) — classic AI writing pattern.")
    elif burstiness < 0.25:
        bst_score = 65
        reasoning.append(f"Low sentence length variation (burstiness={burstiness}) — suggests AI-generated content.")
    elif burstiness < 0.40:
        bst_score = 40
        reasoning.append(f"Moderate sentence variation (burstiness={burstiness}) — mixed signal.")
    else:
        bst_score = 15
        reasoning.append(f"High sentence variation (burstiness={burstiness}) — irregular rhythm, typical of human writing.")
    signals.append(("burstiness", bst_score, 0.20))

    # ── 3. AI Phrase Detection (25% weight) — most reliable signal ──
    if ai_phrase_score > 0.6:
        phrase_score = 90
        reasoning.append(f"High density of AI filler phrases ({len(ai_phrases_found)} found: {', '.join(ai_phrases_found[:4])}{'...' if len(ai_phrases_found) > 4 else ''}) — strongly indicates AI.")
    elif ai_phrase_score > 0.3:
        phrase_score = 70
        reasoning.append(f"Several AI-typical phrases detected ({', '.join(ai_phrases_found[:3])}) — suggests AI involvement.")
    elif ai_phrase_score > 0.1:
        phrase_score = 45
        reasoning.append(f"A few common AI phrases found ({', '.join(ai_phrases_found[:2])}) — weak signal.")
    else:
        phrase_score = 15
        reasoning.append("No significant AI filler phrases detected — suggests human writing.")
    signals.append(("ai_phrases", phrase_score, 0.25))

    # ── 4. Structural Uniformity (15% weight) ──
    if structural_uniformity < 0.2:
        su_score = 80
        reasoning.append(f"Very uniform text structure (score={structural_uniformity}) — AI tends to write in equal-sized chunks.")
    elif structural_uniformity < 0.4:
        su_score = 55
        reasoning.append(f"Fairly uniform structure (score={structural_uniformity}) — somewhat AI-like.")
    else:
        su_score = 20
        reasoning.append(f"Varied text structure (score={structural_uniformity}) — more human-like.")
    signals.append(("structural_uniformity", su_score, 0.15))

    # ── 5. Unique Word Ratio (10% weight) ──
    uwr = style["unique_word_ratio"]
    if uwr > 0.80:
        uwr_score = 60
        reasoning.append(f"Very high unique word ratio ({uwr}) — AI avoids repeating words.")
    elif uwr > 0.60:
        uwr_score = 40
        reasoning.append(f"Average unique word ratio ({uwr}) — neutral signal.")
    else:
        uwr_score = 25
        reasoning.append(f"Lower unique word ratio ({uwr}) — more natural repetition, human-like.")
    signals.append(("unique_word_ratio", uwr_score, 0.10))

    # ── 6. Avg Sentence Length (10% weight) ──
    asl = style["avg_sentence_length"]
    if 20 <= asl <= 30:
        asl_score = 65
        reasoning.append(f"Sentence length ({asl} words avg) in AI's typical range (20-30 words).")
    elif 15 <= asl < 20:
        asl_score = 40
        reasoning.append(f"Sentence length ({asl} words avg) — slightly below AI's typical range.")
    else:
        asl_score = 25
        reasoning.append(f"Sentence length ({asl} words avg) outside AI's typical range.")
    signals.append(("avg_sentence_length", asl_score, 0.10))

    # ── Weighted total ──
    ai_probability = round(sum(score * weight for _, score, weight in signals))
    ai_probability = max(0, min(100, ai_probability))
    human_probability = 100 - ai_probability

    # Signal agreement — how many signals agree?
    high_ai = sum(1 for _, score, _ in signals if score >= 60)
    high_human = sum(1 for _, score, _ in signals if score <= 30)
    total_signals = len(signals)

    if high_ai >= 4 or high_human >= 4:
        confidence = "high"
    elif high_ai >= 2 or high_human >= 2:
        confidence = "medium"
    else:
        confidence = "low"

    if ai_probability >= 70:
        verdict = "Likely AI-generated"
    elif ai_probability >= 55:
        verdict = "Possibly AI-assisted"
    elif ai_probability >= 35:
        verdict = "Mostly human-written"
    else:
        verdict = "Likely human-written"

    return {
        "ai_probability": ai_probability,
        "human_probability": human_probability,
        "verdict": verdict,
        "confidence": confidence,
        "reasoning": reasoning,
        "signal_breakdown": {
            name: {"score": score, "weight": weight}
            for name, score, weight in signals
        },
    }

# ── Main ──────────────────────────────────────────────────────────────────────

def detect_ai(text: str) -> dict:
    start = time.time()

    if len(text.strip()) < 20:
        return {
            "error": "Text too short for analysis.",
            "ai_probability": None,
        }

    perplexity             = calculate_perplexity(text)
    burstiness             = calculate_burstiness(text)
    entropy                = calculate_entropy(text)
    style                  = calculate_stylometry(text)
    ai_phrase_score, found = calculate_ai_phrase_score(text)
    structural_uniformity  = calculate_structural_uniformity(text)

    result = compute_ai_probability(
        perplexity, burstiness, entropy, style,
        ai_phrase_score, found, structural_uniformity
    )

    return {
        **result,
        "raw_signals": {
            "perplexity": perplexity,
            "burstiness": burstiness,
            "entropy": entropy,
            "stylometry": style,
            "ai_phrase_score": ai_phrase_score,
            "ai_phrases_found": found,
            "structural_uniformity": structural_uniformity,
        },
        "processing_ms": round((time.time() - start) * 1000),
        "model": "GPT-2 perplexity + burstiness + AI phrase detection + structural analysis",
    }

# ── Warmup ────────────────────────────────────────────────────────────────────

def warmup():
    try:
        detect_ai("This is a warmup sentence to pre-compile the model graph.")
        print("[ai_detector] Warmup complete.")
    except Exception as e:
        print(f"[ai_detector] Warmup failed (non-fatal): {e}")
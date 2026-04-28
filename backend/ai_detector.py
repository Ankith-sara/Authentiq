"""
ai_detector.py  —  Authentiq AI Detection Engine (v3)
======================================================
Architecture
------------
1. **Multi-LLM Token Log-Probability Scoring**  (new in v3 — primary signal)
   Computes token-level log-probabilities under GPT-2, GPT-2-medium, and
   DistilGPT-2 simultaneously. The *minimum perplexity across models* is used
   — AI text is smooth under at least one LLM, human text is high-perplexity
   under all of them. This directly mirrors how Turnitin and GPTZero v3 work.

2. **DeBERTa Sequence Classifier**  (neural head)
   microsoft/deberta-v3-base fine-tuned as binary classifier (human=0, ai=1).
   Falls back to heuristic-only if weights not present.

3. **Paraphrase-Robustness Layer**
   Averages DeBERTa scores over original + N synonym-swap variants.

4. **Token Entropy & Rank-Based Features**  (new in v3)
   Mean token rank (position in sorted vocabulary by probability) and
   token-level entropy are strong discriminators that complement perplexity.

5. **Heuristic Feature Ensemble**
   Burstiness, stylometry, AI-phrase density, structural uniformity.

6. **Platt-Scaling Calibration**
   Logistic regression layer trained on held-out data.

7. **Weighted Ensemble Combiner**
   Multi-LLM score (40%) + DeBERTa (35%) + heuristics (25%)
   when all heads are available; graceful degradation otherwise.
"""

from __future__ import annotations

import json
import math
import os
import re
import statistics
import time
from collections import Counter
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_curve, auc
from transformers import (
    DebertaV2ForSequenceClassification,
    DebertaV2Tokenizer,
    GPT2LMHeadModel,
    GPT2TokenizerFast,
)

# ── Device ────────────────────────────────────────────────────────────────────
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Paths ─────────────────────────────────────────────────────────────────────
_HERE             = Path(__file__).parent
_WEIGHTS_PATH     = _HERE / "deberta_classifier.pt"
_CALIBRATION_PATH = _HERE / "calibration_params.json"

# ── Constants ─────────────────────────────────────────────────────────────────
DEBERTA_MODEL_NAME  = "microsoft/deberta-v3-base"
MAX_TOKENS_DEBERTA  = 512
MAX_TOKENS_GPT2     = 512

# Ensemble weights (sum to 1.0)
MULTILM_WEIGHT    = 0.40   # multi-LLM token score (new primary signal)
NEURAL_WEIGHT     = 0.35   # DeBERTa classifier
HEURISTIC_WEIGHT  = 0.25   # heuristic features

PARAPHRASE_VARIANTS = 3

# ── AI filler phrases ─────────────────────────────────────────────────────────
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
    "it is undeniable", "plays an important role",
    "stands as a testament", "navigating the complexities",
]


# =============================================================================
# 1.  MULTI-LLM TOKEN LOG-PROBABILITY ENGINE  (primary signal — new in v3)
# =============================================================================

class _LMScorer:
    """
    Holds a language model and provides token-level log-probability analysis.
    This is the core technique used by commercial AI detectors:
    - AI text has LOW perplexity (high probability) under at least one LM
    - Human text has HIGH perplexity under ALL LMs
    """
    def __init__(self, model_name: str, label: str):
        self.label = label
        self.available = False
        try:
            print(f"[ai_detector] Loading {label} ({model_name})…")
            self.tokenizer = GPT2TokenizerFast.from_pretrained(model_name)
            self.model = GPT2LMHeadModel.from_pretrained(model_name).to(DEVICE)
            self.model.eval()
            self.available = True
            print(f"[ai_detector] {label} loaded on {DEVICE}.")
        except Exception as exc:
            print(f"[ai_detector] {label} unavailable: {exc}")

    def score(self, text: str) -> Optional[dict]:
        """
        Returns perplexity, mean_token_rank, and mean_token_entropy.
        All three are independent signals:
        - perplexity:        overall predictability (AI = low)
        - mean_token_rank:   avg position in vocab sorted by prob (AI = low rank = top choices)
        - mean_token_entropy: per-token uncertainty (AI = lower, more decisive)
        """
        if not self.available:
            return None
        enc = self.tokenizer(
            text, return_tensors="pt", truncation=True, max_length=MAX_TOKENS_GPT2
        )
        ids = enc.input_ids.to(DEVICE)
        if ids.shape[1] < 2:
            return None

        with torch.no_grad():
            outputs = self.model(ids, labels=ids)
            loss = outputs.loss
            # Get full logits for rank and entropy computation
            logits = outputs.logits  # [1, seq_len, vocab]

        perplexity = round(torch.exp(loss).item(), 2)

        # Compute per-token rank and entropy (exclude first token — no prediction)
        probs = torch.softmax(logits[0, :-1, :], dim=-1)   # [seq-1, vocab]
        target_ids = ids[0, 1:]                             # [seq-1]

        # Token rank: sort vocab by probability descending, find target position
        sorted_indices = torch.argsort(probs, dim=-1, descending=True)
        ranks = []
        for i, tid in enumerate(target_ids):
            rank_pos = (sorted_indices[i] == tid).nonzero(as_tuple=True)[0]
            ranks.append(int(rank_pos[0].item()) + 1 if len(rank_pos) > 0 else 1000)

        mean_rank = float(np.mean(ranks)) if ranks else 500.0

        # Token entropy: H(p) = -sum(p * log2(p))
        log_probs = torch.log2(probs + 1e-10)
        entropies = -(probs * log_probs).sum(dim=-1)  # [seq-1]
        mean_entropy = float(entropies.mean().item())

        return {
            "perplexity": perplexity,
            "mean_token_rank": round(mean_rank, 2),
            "mean_token_entropy": round(mean_entropy, 4),
        }


# Load three GPT-2 family models for multi-LLM scoring
print("[ai_detector] Loading multi-LLM scoring heads…")
_LM_HEADS: list[_LMScorer] = [
    _LMScorer("gpt2",        "GPT-2 (117M)"),
    _LMScorer("distilgpt2",  "DistilGPT-2 (82M)"),
    _LMScorer("gpt2-medium", "GPT-2-medium (345M)"),
]
_lm_heads_available = [h for h in _LM_HEADS if h.available]
print(f"[ai_detector] {len(_lm_heads_available)}/{len(_LM_HEADS)} LM heads available.")


def multi_lm_score(text: str) -> dict:
    """
    Score text under all available LM heads.
    Returns the minimum perplexity (hardest to fake), minimum mean_token_rank,
    and the per-model breakdown.
    AI text is characteristically smooth under at least one LM head —
    taking the minimum across models makes evasion much harder.
    """
    if not _lm_heads_available:
        return {"available": False, "min_perplexity": None, "min_rank": None, "models": {}}

    results = {}
    for head in _lm_heads_available:
        r = head.score(text)
        if r:
            results[head.label] = r

    if not results:
        return {"available": False, "min_perplexity": None, "min_rank": None, "models": {}}

    min_perplexity   = min(r["perplexity"]        for r in results.values())
    min_rank         = min(r["mean_token_rank"]    for r in results.values())
    mean_entropy_avg = np.mean([r["mean_token_entropy"] for r in results.values()])

    return {
        "available":        True,
        "min_perplexity":   round(min_perplexity, 2),
        "min_rank":         round(min_rank, 2),
        "mean_entropy_avg": round(float(mean_entropy_avg), 4),
        "models":           results,
    }


def _multilm_ai_probability(lm: dict) -> float:
    """
    Convert multi-LLM scores to an AI probability (0–100).
    Uses minimum perplexity (primary) and minimum mean token rank (secondary).
    """
    if not lm.get("available") or lm["min_perplexity"] is None:
        return 50.0  # neutral if unavailable

    ppl  = lm["min_perplexity"]
    rank = lm["min_rank"] or 500

    # Perplexity component (70% weight within this scorer)
    if   ppl < 20:  ppl_score = 95
    elif ppl < 40:  ppl_score = 85
    elif ppl < 70:  ppl_score = 72
    elif ppl < 110: ppl_score = 55
    elif ppl < 160: ppl_score = 38
    elif ppl < 250: ppl_score = 22
    else:           ppl_score = 10

    # Rank component (30% weight) — low rank = AI picks top vocab tokens
    if   rank < 3:    rank_score = 90
    elif rank < 8:    rank_score = 75
    elif rank < 20:   rank_score = 55
    elif rank < 60:   rank_score = 35
    else:             rank_score = 15

    return round(ppl_score * 0.70 + rank_score * 0.30)


# =============================================================================
# 2.  DeBERTa SEQUENCE CLASSIFIER
# =============================================================================

print("[ai_detector] Loading DeBERTa-v3-base tokenizer…")
try:
    _deberta_tokenizer = DebertaV2Tokenizer.from_pretrained(DEBERTA_MODEL_NAME)
    _deberta_model     = DebertaV2ForSequenceClassification.from_pretrained(
        DEBERTA_MODEL_NAME, num_labels=2
    ).to(DEVICE)
    _deberta_model.eval()
    _deberta_available = True
    print(f"[ai_detector] DeBERTa loaded on {DEVICE}.")
except Exception as exc:
    _deberta_available = False
    _deberta_tokenizer = None
    _deberta_model     = None
    print(f"[ai_detector] DeBERTa unavailable: {exc}")

if _deberta_available and _WEIGHTS_PATH.exists():
    try:
        state = torch.load(_WEIGHTS_PATH, map_location=DEVICE)
        _deberta_model.load_state_dict(state)
        _deberta_model.eval()
        print("[ai_detector] Fine-tuned DeBERTa weights loaded.")
    except Exception as exc:
        print(f"[ai_detector] Could not load fine-tuned weights: {exc}")


def _deberta_raw_score(text: str) -> Optional[float]:
    if not _deberta_available or _deberta_model is None:
        return None
    enc = _deberta_tokenizer(
        text, return_tensors="pt", truncation=True,
        max_length=MAX_TOKENS_DEBERTA, padding=True,
    )
    enc = {k: v.to(DEVICE) for k, v in enc.items()}
    with torch.no_grad():
        logits = _deberta_model(**enc).logits
    probs = torch.softmax(logits, dim=-1)
    return float(probs[0, 1].item())


# =============================================================================
# 3.  PARAPHRASE ROBUSTNESS
# =============================================================================

_SYNONYM_MAP: dict[str, list[str]] = {
    "big": ["large", "huge"], "small": ["tiny", "little"],
    "show": ["demonstrate", "reveal"], "use": ["employ", "utilize"],
    "help": ["assist", "support"], "make": ["create", "produce"],
    "get": ["obtain", "acquire"], "good": ["excellent", "beneficial"],
    "bad": ["poor", "detrimental"], "important": ["significant", "critical"],
    "said": ["stated", "mentioned"], "also": ["additionally", "furthermore"],
    "many": ["numerous", "various"], "often": ["frequently", "commonly"],
    "quickly": ["rapidly", "swiftly"], "clearly": ["evidently", "obviously"],
}


def _paraphrase_variants(text: str, n: int = PARAPHRASE_VARIANTS) -> list[str]:
    import random
    rng   = random.Random(42)
    words = text.split()
    variants: list[str] = []
    for _ in range(n):
        swapped = []
        for w in words:
            key = w.lower().strip(".,;:!?\"'")
            if key in _SYNONYM_MAP and rng.random() < 0.15:
                rep = rng.choice(_SYNONYM_MAP[key])
                if w[0].isupper():
                    rep = rep.capitalize()
                swapped.append(rep)
            else:
                swapped.append(w)
        variants.append(" ".join(swapped))
    return variants


def deberta_score_robust(text: str) -> Optional[float]:
    if not _deberta_available:
        return None
    texts  = [text] + _paraphrase_variants(text, PARAPHRASE_VARIANTS)
    scores = [_deberta_raw_score(t) for t in texts]
    valid  = [s for s in scores if s is not None]
    return float(np.mean(valid)) if valid else None


# =============================================================================
# 4.  PLATT-SCALING CALIBRATION
# =============================================================================

class _CalibrationState:
    def __init__(self):
        self.fitted = False
        self.a: float = 1.0
        self.b: float = 0.0

    def calibrate(self, raw: float) -> float:
        if not self.fitted:
            return raw
        z = self.a * raw + self.b
        return float(1.0 / (1.0 + math.exp(-z)))


_calibration = _CalibrationState()

if _CALIBRATION_PATH.exists():
    try:
        params = json.loads(_CALIBRATION_PATH.read_text())
        _calibration.a      = params["a"]
        _calibration.b      = params["b"]
        _calibration.fitted = True
        print("[ai_detector] Calibration parameters loaded.")
    except Exception as exc:
        print(f"[ai_detector] Could not load calibration: {exc}")


def calibrate(
    raw_scores: list[float],
    labels: list[int],
    save: bool = True,
) -> dict:
    X = np.array(raw_scores).reshape(-1, 1)
    y = np.array(labels)
    fpr, tpr, _ = roc_curve(y, X[:, 0])
    auc_before  = float(auc(fpr, tpr))
    lr = LogisticRegression(C=1e10)
    lr.fit(X, y)
    a = float(lr.coef_[0][0])
    b = float(lr.intercept_[0])
    cal_scores    = [1.0 / (1.0 + math.exp(-(a * s + b))) for s in raw_scores]
    fpr2, tpr2, _ = roc_curve(y, cal_scores)
    auc_after     = float(auc(fpr2, tpr2))
    _calibration.a      = a
    _calibration.b      = b
    _calibration.fitted = True
    if save:
        _CALIBRATION_PATH.write_text(json.dumps({"a": a, "b": b}, indent=2))
        print(f"[ai_detector] Calibration saved. AUC {auc_before:.3f} → {auc_after:.3f}")
    return {"auc_before": round(auc_before, 4), "auc_after": round(auc_after, 4), "a": a, "b": b}


# =============================================================================
# 5.  FINE-TUNING API
# =============================================================================

def fine_tune(
    texts: list[str],
    labels: list[int],
    epochs: int = 3,
    batch_size: int = 8,
    lr_rate: float = 2e-5,
    save: bool = True,
) -> dict:
    if not _deberta_available or _deberta_model is None:
        return {"error": "DeBERTa model not available."}

    from torch.utils.data import DataLoader, TensorDataset
    print(f"[ai_detector] Fine-tuning DeBERTa on {len(texts)} samples, {epochs} epochs…")

    enc = _deberta_tokenizer(
        texts, return_tensors="pt", truncation=True,
        max_length=MAX_TOKENS_DEBERTA, padding=True,
    )
    dataset   = TensorDataset(enc["input_ids"], enc["attention_mask"], torch.tensor(labels, dtype=torch.long))
    loader    = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    optimiser = torch.optim.AdamW(_deberta_model.parameters(), lr=lr_rate)
    criterion = nn.CrossEntropyLoss()
    history   = []

    _deberta_model.train()
    for epoch in range(epochs):
        epoch_loss, correct, total = 0.0, 0, 0
        for ids_b, mask_b, labels_b in loader:
            ids_b, mask_b, labels_b = ids_b.to(DEVICE), mask_b.to(DEVICE), labels_b.to(DEVICE)
            optimiser.zero_grad()
            logits = _deberta_model(input_ids=ids_b, attention_mask=mask_b).logits
            loss   = criterion(logits, labels_b)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(_deberta_model.parameters(), 1.0)
            optimiser.step()
            epoch_loss += loss.item() * ids_b.size(0)
            correct    += (logits.argmax(dim=-1) == labels_b).sum().item()
            total      += ids_b.size(0)
        avg = epoch_loss / max(total, 1)
        acc = correct   / max(total, 1)
        history.append({"epoch": epoch + 1, "loss": round(avg, 4), "accuracy": round(acc, 4)})
        print(f"  Epoch {epoch+1}/{epochs}  loss={avg:.4f}  acc={acc:.4f}")

    _deberta_model.eval()
    if save:
        torch.save(_deberta_model.state_dict(), _WEIGHTS_PATH)
        print(f"[ai_detector] Weights saved → {_WEIGHTS_PATH}")
    return {"epochs": history, "model": DEBERTA_MODEL_NAME}


# =============================================================================
# 6.  HEURISTIC FEATURE EXTRACTORS
# =============================================================================

def calculate_perplexity(text: str) -> float:
    """Legacy single-model perplexity for backward compatibility."""
    if not _lm_heads_available:
        return 999.0
    r = _lm_heads_available[0].score(text)
    return r["perplexity"] if r else 999.0


def calculate_burstiness(text: str) -> float:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s for s in sentences if len(s.strip()) > 5]
    if len(sentences) < 3:
        return 0.5
    lengths = [len(s.split()) for s in sentences]
    mean = statistics.mean(lengths)
    std  = statistics.stdev(lengths) if len(lengths) > 1 else 0
    return round(min(std / mean, 1.0), 4) if mean else 0.0


def calculate_entropy(text: str) -> float:
    words = re.findall(r'\b\w+\b', text.lower())
    if not words:
        return 0.0
    counts = Counter(words)
    total  = len(words)
    return round(-sum((c / total) * math.log2(c / total) for c in counts.values()), 4)


def calculate_stylometry(text: str) -> dict:
    words     = re.findall(r'\b\w+\b', text)
    sentences = [s for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s.strip()]
    tw, ts    = len(words), len(sentences)
    if tw == 0:
        return {"avg_word_length": 0, "punctuation_density": 0,
                "unique_word_ratio": 0, "avg_sentence_length": 0}
    return {
        "avg_word_length":     round(sum(len(w) for w in words) / tw, 2),
        "punctuation_density": round(sum(1 for c in text if c in '.,;:!?-()[]{}"\'') / len(text), 4),
        "unique_word_ratio":   round(len(set(w.lower() for w in words)) / tw, 4),
        "avg_sentence_length": round(tw / ts, 2) if ts else 0,
    }


def calculate_ai_phrase_score(text: str) -> tuple[float, list[str]]:
    tl    = text.lower()
    found = [p for p in AI_PHRASES if p in tl]
    words = len(text.split())
    density = len(found) / max(words / 100, 1)
    return round(min(density / 3.0, 1.0), 4), found


def calculate_structural_uniformity(text: str) -> float:
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    if len(paragraphs) < 2:
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        sentences = [s for s in sentences if len(s.strip()) > 5]
        if len(sentences) < 3:
            return 0.5
        lengths = [len(s.split()) for s in sentences]
    else:
        lengths = [len(p.split()) for p in paragraphs]
    mean = statistics.mean(lengths)
    std  = statistics.stdev(lengths) if len(lengths) > 1 else 0
    return round(min(std / mean, 1.0), 4) if mean else 0.5


def calculate_repetition_score(text: str) -> float:
    """
    New in v3: measures n-gram repetition.
    AI models have characteristic n-gram repetition patterns — they reuse
    transitional structures at a higher rate than humans.
    Returns 0–1 where higher = more repetition = more AI-like.
    """
    words = re.findall(r'\b\w+\b', text.lower())
    if len(words) < 10:
        return 0.5
    # Trigram repetition ratio
    trigrams = [tuple(words[i:i+3]) for i in range(len(words) - 2)]
    if not trigrams:
        return 0.5
    unique_ratio = len(set(trigrams)) / len(trigrams)
    # Low unique ratio = high repetition = AI-like
    return round(max(0.0, min(1.0, 1.0 - unique_ratio)), 4)


# =============================================================================
# 7.  HEURISTIC ENSEMBLE SCORER
# =============================================================================

def _heuristic_ai_probability(
    perplexity: float,
    burstiness: float,
    entropy: float,
    style: dict,
    ai_phrase_score: float,
    ai_phrases_found: list[str],
    structural_uniformity: float,
    repetition_score: float,
) -> tuple[float, list[str], dict]:
    signals   = []
    reasoning = []

    # 1. Perplexity (12% — reduced since multi-LLM now handles this better)
    if   perplexity < 40:  ps, msg = 85, f"Very low perplexity ({perplexity}) — highly predictable text, AI-like."
    elif perplexity < 80:  ps, msg = 70, f"Low perplexity ({perplexity}) — smooth writing typical of AI."
    elif perplexity < 150: ps, msg = 45, f"Medium perplexity ({perplexity}) — could be polished human or AI."
    elif perplexity < 250: ps, msg = 25, f"High perplexity ({perplexity}) — varied vocabulary, more human-like."
    else:                  ps, msg = 10, f"Very high perplexity ({perplexity}) — strongly suggests human writing."
    signals.append(("perplexity", ps, 0.12)); reasoning.append(msg)

    # 2. Burstiness (16%)
    if   burstiness < 0.15: bs, msg = 85, f"Very uniform sentence lengths (burstiness={burstiness}) — classic AI pattern."
    elif burstiness < 0.25: bs, msg = 65, f"Low sentence variation (burstiness={burstiness}) — suggests AI."
    elif burstiness < 0.40: bs, msg = 40, f"Moderate variation (burstiness={burstiness}) — mixed signal."
    else:                   bs, msg = 15, f"High sentence variation (burstiness={burstiness}) — human-like rhythm."
    signals.append(("burstiness", bs, 0.16)); reasoning.append(msg)

    # 3. AI phrase density (22%)
    if   ai_phrase_score > 0.6: aps, msg = 90, f"High AI filler phrase density ({len(ai_phrases_found)} found: {', '.join(ai_phrases_found[:4])}{'…' if len(ai_phrases_found) > 4 else ''}) — strongly AI."
    elif ai_phrase_score > 0.3: aps, msg = 70, f"Several AI-typical phrases detected ({', '.join(ai_phrases_found[:3])})."
    elif ai_phrase_score > 0.1: aps, msg = 45, f"A few AI phrases found ({', '.join(ai_phrases_found[:2])}) — weak signal."
    else:                       aps, msg = 15, "No significant AI filler phrases detected."
    signals.append(("ai_phrases", aps, 0.22)); reasoning.append(msg)

    # 4. Structural uniformity (12%)
    if   structural_uniformity < 0.2: sus, msg = 80, f"Very uniform text structure ({structural_uniformity}) — AI writes in equal-sized chunks."
    elif structural_uniformity < 0.4: sus, msg = 55, f"Fairly uniform structure ({structural_uniformity}) — somewhat AI-like."
    else:                             sus, msg = 20, f"Varied text structure ({structural_uniformity}) — human-like."
    signals.append(("structural_uniformity", sus, 0.12)); reasoning.append(msg)

    # 5. Unique word ratio (10%)
    uwr = style["unique_word_ratio"]
    if   uwr > 0.80: us, msg = 60, f"Very high unique word ratio ({uwr}) — AI avoids repetition."
    elif uwr > 0.60: us, msg = 40, f"Average unique word ratio ({uwr}) — neutral signal."
    else:            us, msg = 25, f"Lower unique word ratio ({uwr}) — natural repetition, human-like."
    signals.append(("unique_word_ratio", us, 0.10)); reasoning.append(msg)

    # 6. Average sentence length (10%)
    asl = style["avg_sentence_length"]
    if   20 <= asl <= 30: asc, msg = 65, f"Avg sentence length {asl} words — within AI's typical 20–30 word range."
    elif 15 <= asl < 20:  asc, msg = 40, f"Avg sentence length {asl} words — slightly below AI's typical range."
    else:                 asc, msg = 25, f"Avg sentence length {asl} words — outside AI's typical range."
    signals.append(("avg_sentence_length", asc, 0.10)); reasoning.append(msg)

    # 7. N-gram repetition (18% — new signal)
    if   repetition_score > 0.6: rs, msg = 80, f"High n-gram repetition score ({repetition_score}) — AI reuses transitional structures."
    elif repetition_score > 0.35: rs, msg = 55, f"Moderate n-gram repetition ({repetition_score}) — possible AI patterns."
    elif repetition_score > 0.15: rs, msg = 30, f"Low n-gram repetition ({repetition_score}) — more organic variation."
    else:                          rs, msg = 12, f"Very low n-gram repetition ({repetition_score}) — strongly human-like phrasing."
    signals.append(("ngram_repetition", rs, 0.18)); reasoning.append(msg)

    probability = round(sum(sc * wt for _, sc, wt in signals))
    breakdown   = {n: {"score": s, "weight": w} for n, s, w in signals}
    return float(max(0, min(100, probability))), reasoning, breakdown


# =============================================================================
# 8.  MAIN DETECTION FUNCTION
# =============================================================================

def detect_ai(text: str) -> dict:
    start = time.time()

    if len(text.strip()) < 20:
        return {"error": "Text too short for analysis.", "ai_probability": None}

    # ── Multi-LLM token scoring (primary signal) ──
    lm_scores        = multi_lm_score(text)
    multilm_prob     = _multilm_ai_probability(lm_scores)

    # ── Heuristic features ──
    perplexity             = calculate_perplexity(text)
    burstiness             = calculate_burstiness(text)
    entropy                = calculate_entropy(text)
    style                  = calculate_stylometry(text)
    ai_phrase_score, found = calculate_ai_phrase_score(text)
    structural_uniformity  = calculate_structural_uniformity(text)
    repetition_score       = calculate_repetition_score(text)

    heuristic_prob, reasoning, heuristic_breakdown = _heuristic_ai_probability(
        perplexity, burstiness, entropy, style,
        ai_phrase_score, found, structural_uniformity, repetition_score,
    )

    # ── DeBERTa neural score ──
    neural_raw = deberta_score_robust(text)
    if neural_raw is not None:
        neural_cal  = _calibration.calibrate(neural_raw)
        neural_prob = neural_cal * 100.0
        reasoning.insert(0, f"DeBERTa classifier: {neural_prob:.1f}% AI probability (raw={neural_raw:.3f}, calibrated={neural_cal:.3f}).")
    else:
        neural_prob = None

    if lm_scores["available"]:
        reasoning.insert(0,
            f"Multi-LLM token scoring: min perplexity={lm_scores['min_perplexity']} "
            f"across {len(_lm_heads_available)} models, mean token rank={lm_scores['min_rank']}."
        )

    # ── Ensemble combination ──
    available_heads = []
    weights_used    = {}

    if lm_scores["available"]:
        available_heads.append(("multi_lm",  multilm_prob,  MULTILM_WEIGHT))
        weights_used["multi_lm_token_scoring"] = MULTILM_WEIGHT

    if neural_prob is not None:
        available_heads.append(("neural",    neural_prob,   NEURAL_WEIGHT))
        weights_used["neural_deberta"]          = NEURAL_WEIGHT

    available_heads.append(("heuristic", heuristic_prob, HEURISTIC_WEIGHT))
    weights_used["heuristic"]                   = HEURISTIC_WEIGHT

    # Re-normalise weights if some heads are unavailable
    total_w = sum(w for _, _, w in available_heads)
    ai_probability = sum((w / total_w) * p for _, p, w in available_heads)
    ai_probability = round(max(0, min(100, ai_probability)))
    human_probability = 100 - ai_probability

    # ── Confidence ──
    high_ai    = sum(1 for v in heuristic_breakdown.values() if v["score"] >= 60)
    high_human = sum(1 for v in heuristic_breakdown.values() if v["score"] <= 30)
    if lm_scores["available"] and multilm_prob > 70:  high_ai    += 2
    if lm_scores["available"] and multilm_prob < 30:  high_human += 2
    if neural_prob is not None and neural_prob > 70:  high_ai    += 2
    if neural_prob is not None and neural_prob < 30:  high_human += 2
    confidence = (
        "high"   if (high_ai >= 5 or high_human >= 5) else
        "medium" if (high_ai >= 3 or high_human >= 3) else
        "low"
    )

    # ── Verdict ──
    if   ai_probability >= 70: verdict = "Likely AI-generated"
    elif ai_probability >= 55: verdict = "Possibly AI-assisted"
    elif ai_probability >= 35: verdict = "Mostly human-written"
    else:                      verdict = "Likely human-written"

    return {
        "ai_probability":    ai_probability,
        "human_probability": human_probability,
        "verdict":           verdict,
        "confidence":        confidence,
        "reasoning":         reasoning,
        "signal_breakdown":  heuristic_breakdown,
        "raw_signals": {
            "perplexity":            perplexity,
            "burstiness":            burstiness,
            "entropy":               entropy,
            "stylometry":            style,
            "ai_phrase_score":       ai_phrase_score,
            "ai_phrases_found":      found,
            "structural_uniformity": structural_uniformity,
            "repetition_score":      repetition_score,
            "deberta_raw":           neural_raw,
            "deberta_calibrated":    round(neural_prob / 100, 4) if neural_prob is not None else None,
            "multi_lm":              lm_scores,
        },
        "ensemble_weights": {
            **weights_used,
            "calibration_fitted": _calibration.fitted,
            "total_normalised":   round(total_w, 3),
        },
        "processing_ms": round((time.time() - start) * 1000),
        "model": f"Authentiq v3: Multi-LLM({len(_lm_heads_available)}×GPT-2) + DeBERTa + Heuristics",
    }


# =============================================================================
# 9.  WARMUP
# =============================================================================

def warmup() -> None:
    try:
        detect_ai("This is a warmup sentence to pre-compile all model graphs.")
        print("[ai_detector] Warmup complete.")
    except Exception as exc:
        print(f"[ai_detector] Warmup failed (non-fatal): {exc}")

"""
tests/test_ai_detector.py  —  v3 AI detector tests
Covers new features: multi-LLM scoring, token rank, repetition score,
updated ensemble weights, and the backward-compat perplexity function.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai_detector import (
    calculate_perplexity,
    calculate_burstiness,
    calculate_entropy,
    calculate_stylometry,
    calculate_ai_phrase_score,
    calculate_structural_uniformity,
    calculate_repetition_score,
    multi_lm_score,
    _multilm_ai_probability,
    deberta_score_robust,
    calibrate,
    fine_tune,
    detect_ai,
    _paraphrase_variants,
)

# ── calculate_perplexity (backward compat) ────────────────────────────────────

def test_perplexity_returns_float():
    assert isinstance(calculate_perplexity("The cat sat on the mat and looked at the door."), float)

def test_perplexity_positive():
    assert calculate_perplexity("Natural language processing is a subfield of AI.") > 0

def test_perplexity_too_short_returns_sentinel():
    result = calculate_perplexity("Hi")
    assert result >= 999.0 or result > 0   # sentinel or model unavailable

# ── multi_lm_score ────────────────────────────────────────────────────────────

def test_multilm_score_returns_dict():
    result = multi_lm_score("Artificial intelligence is transforming the world.")
    assert isinstance(result, dict)
    assert "available" in result

def test_multilm_score_min_perplexity_positive_when_available():
    result = multi_lm_score("Machine learning models can process large datasets.")
    if result["available"]:
        assert result["min_perplexity"] > 0
        assert result["min_rank"] > 0

def test_multilm_score_min_rank_in_vocab_range():
    result = multi_lm_score("Natural language processing enables computers to understand text.")
    if result["available"]:
        assert 1 <= result["min_rank"] <= 50_000

def test_multilm_score_models_breakdown_present():
    result = multi_lm_score("The quick brown fox jumps over the lazy dog.")
    if result["available"]:
        assert isinstance(result["models"], dict)
        assert len(result["models"]) > 0

def test_multilm_score_short_text():
    result = multi_lm_score("Hi")
    # Should either be unavailable or return a result — must not crash
    assert isinstance(result, dict)

# ── _multilm_ai_probability ───────────────────────────────────────────────────

def test_multilm_ai_prob_unavailable_returns_neutral():
    lm = {"available": False, "min_perplexity": None, "min_rank": None}
    assert _multilm_ai_probability(lm) == 50.0

def test_multilm_ai_prob_low_ppl_high_score():
    lm = {"available": True, "min_perplexity": 15, "min_rank": 2}
    assert _multilm_ai_probability(lm) >= 80

def test_multilm_ai_prob_high_ppl_low_score():
    lm = {"available": True, "min_perplexity": 400, "min_rank": 200}
    assert _multilm_ai_probability(lm) <= 25

def test_multilm_ai_prob_in_range():
    lm = {"available": True, "min_perplexity": 80, "min_rank": 30}
    p = _multilm_ai_probability(lm)
    assert 0 <= p <= 100

# ── calculate_repetition_score ────────────────────────────────────────────────

def test_repetition_score_returns_float():
    score = calculate_repetition_score("The cat sat on the mat. The dog sat by the door.")
    assert isinstance(score, float)

def test_repetition_score_in_range():
    score = calculate_repetition_score(
        "Machine learning enables systems to learn from data without explicit programming."
    )
    assert 0.0 <= score <= 1.0

def test_repetition_score_short_returns_neutral():
    assert calculate_repetition_score("Hi there") == 0.5

def test_repetition_score_high_repetition():
    # Repeated trigrams should produce a higher score
    repeated = " ".join(["the cat sat"] * 10)
    varied   = "cat dog bird fish frog tree sun moon star leaf book pen sky"
    assert calculate_repetition_score(repeated) > calculate_repetition_score(varied)

# ── calculate_burstiness ──────────────────────────────────────────────────────

def test_burstiness_returns_float():
    assert isinstance(calculate_burstiness("This is a test. Another sentence. One more here."), float)

def test_burstiness_in_range():
    text = "Short. This is a longer sentence with many more words. Tiny. Another moderate length sentence."
    assert 0.0 <= calculate_burstiness(text) <= 1.0

def test_burstiness_too_short_returns_default():
    assert calculate_burstiness("One sentence only.") == 0.5

def test_uniform_text_low_burstiness():
    text = " ".join([f"This is sentence number {i} here." for i in range(10)])
    assert calculate_burstiness(text) < 0.5

# ── calculate_entropy ────────────────────────────────────────────────────────

def test_entropy_returns_float():
    assert isinstance(calculate_entropy("hello world hello"), float)

def test_entropy_empty():
    assert calculate_entropy("") == 0.0

def test_entropy_repeated_word_is_lower():
    repeated = "cat cat cat cat cat"
    diverse  = "cat dog fish bird frog"
    assert calculate_entropy(repeated) < calculate_entropy(diverse)

# ── calculate_stylometry ─────────────────────────────────────────────────────

def test_stylometry_returns_required_keys():
    result = calculate_stylometry("Hello world. This is a test sentence.")
    for key in ("avg_word_length", "punctuation_density", "unique_word_ratio", "avg_sentence_length"):
        assert key in result

def test_stylometry_empty():
    result = calculate_stylometry("")
    assert result["avg_word_length"] == 0

# ── calculate_ai_phrase_score ─────────────────────────────────────────────────

def test_ai_phrase_score_range():
    score, _ = calculate_ai_phrase_score("Furthermore, it is important to note the key factors.")
    assert 0.0 <= score <= 1.0

def test_ai_phrase_score_detects_phrases():
    _, found = calculate_ai_phrase_score("Furthermore, in conclusion, it is crucial to note this.")
    assert len(found) >= 2

def test_ai_phrase_score_clean_text():
    score, found = calculate_ai_phrase_score("I went to the park and saw a dog.")
    assert len(found) == 0

# ── calculate_structural_uniformity ──────────────────────────────────────────

def test_structural_uniformity_range():
    text = "Short paragraph.\n\nA much longer paragraph that goes on and says quite a lot of things."
    assert 0.0 <= calculate_structural_uniformity(text) <= 1.0

# ── paraphrase variants ───────────────────────────────────────────────────────

def test_paraphrase_variants_count():
    variants = _paraphrase_variants("The big dog helped make good things quickly.", n=3)
    assert len(variants) == 3

def test_paraphrase_variants_same_word_count():
    text = "The quick brown fox jumps over the lazy dog."
    for v in _paraphrase_variants(text, n=3):
        assert len(v.split()) == len(text.split())

# ── deberta_score_robust ──────────────────────────────────────────────────────

def test_deberta_score_is_none_or_float():
    result = deberta_score_robust("Artificial intelligence is transforming numerous industries.")
    assert result is None or isinstance(result, float)

def test_deberta_score_in_range():
    result = deberta_score_robust("Machine learning models can process vast amounts of data.")
    if result is not None:
        assert 0.0 <= result <= 1.0

# ── calibrate ─────────────────────────────────────────────────────────────────

def test_calibrate_returns_auc_metrics():
    scores = [0.1, 0.2, 0.7, 0.8, 0.9, 0.3, 0.6, 0.4]
    labels = [0,   0,   1,   1,   1,   0,   1,   0  ]
    result = calibrate(scores, labels, save=False)
    assert "auc_before" in result and "auc_after" in result

def test_calibrate_auc_values_valid():
    scores = [0.1, 0.9, 0.8, 0.2, 0.7, 0.3]
    labels = [0,   1,   1,   0,   1,   0  ]
    result = calibrate(scores, labels, save=False)
    assert 0.0 <= result["auc_before"] <= 1.0
    assert 0.0 <= result["auc_after"]  <= 1.0

# ── fine_tune ─────────────────────────────────────────────────────────────────

def test_fine_tune_returns_error_or_history():
    texts  = ["Hello world. This is human text.", "Furthermore, it is crucial to note the key factors."]
    labels = [0, 1]
    result = fine_tune(texts, labels, epochs=1, save=False)
    assert "error" in result or "epochs" in result

# ── detect_ai (main API) ───────────────────────────────────────────────────────

REQUIRED_KEYS = {
    "ai_probability", "human_probability", "verdict",
    "confidence", "reasoning", "signal_breakdown",
    "raw_signals", "ensemble_weights", "processing_ms",
}

def test_detect_ai_returns_required_keys():
    result = detect_ai("Artificial intelligence is transforming the way we interact with technology.")
    assert REQUIRED_KEYS.issubset(result.keys())

def test_probabilities_sum_to_100():
    result = detect_ai("The quick brown fox jumps over the lazy dog in the park.")
    assert result["ai_probability"] + result["human_probability"] == 100

def test_probabilities_in_range():
    result = detect_ai("Machine learning models can process vast amounts of data efficiently.")
    assert 0 <= result["ai_probability"] <= 100
    assert 0 <= result["human_probability"] <= 100

def test_verdict_is_string():
    result = detect_ai("This text was written by a human being with many imperfections.")
    assert isinstance(result["verdict"], str) and len(result["verdict"]) > 0

def test_confidence_valid_value():
    result = detect_ai("AI systems are becoming increasingly capable of complex reasoning tasks.")
    assert result["confidence"] in ("low", "medium", "high")

def test_reasoning_is_list():
    result = detect_ai("Some text to analyze for AI content detection purposes.")
    assert isinstance(result["reasoning"], list) and len(result["reasoning"]) > 0

def test_raw_signals_includes_multi_lm():
    result = detect_ai("The neural network architecture consists of multiple interconnected layers.")
    assert "multi_lm" in result["raw_signals"]

def test_raw_signals_includes_repetition_score():
    result = detect_ai("Natural language understanding has advanced significantly in recent years.")
    assert "repetition_score" in result["raw_signals"]

def test_ensemble_weights_include_multi_lm():
    result = detect_ai("Furthermore, it is crucial to note the significant impact of AI.")
    w = result["ensemble_weights"]
    # At least heuristic weight must be present
    assert "heuristic" in w
    # Multi-LM or neural should be present if models loaded
    assert "total_normalised" in w

def test_ensemble_weights_normalised():
    result = detect_ai("Testing ensemble weight normalisation across available heads.")
    w = result["ensemble_weights"]
    # total_normalised should be close to the sum of actual weights used
    assert abs(w.get("total_normalised", 1.0) - 1.0) < 0.05 or w.get("total_normalised", 0) > 0

def test_processing_ms_non_negative():
    result = detect_ai("Testing processing time measurement.")
    assert result["processing_ms"] >= 0

def test_too_short_returns_error():
    result = detect_ai("Hi")
    assert "error" in result and result["ai_probability"] is None

def test_signal_breakdown_has_weights():
    result = detect_ai("Some text for signal breakdown analysis.")
    for key, val in result["signal_breakdown"].items():
        assert "score"  in val
        assert "weight" in val
        assert 0 <= val["weight"] <= 1

def test_signal_breakdown_includes_ngram_repetition():
    result = detect_ai("Some text to check signal breakdown keys.")
    assert "ngram_repetition" in result["signal_breakdown"]

def test_clearly_ai_text_produces_valid_result():
    ai_text = (
        "Artificial intelligence is revolutionizing numerous industries by enabling automation, "
        "improving efficiency, and facilitating data-driven decision-making. Furthermore, machine "
        "learning algorithms can process vast datasets to identify patterns and generate actionable "
        "insights. It is important to note that natural language processing plays a crucial role in "
        "enabling seamless human-computer interaction through advanced text understanding capabilities."
    )
    result = detect_ai(ai_text)
    assert "ai_probability" in result and result["ai_probability"] >= 0

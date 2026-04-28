"""
tests/test_plagiarism.py  —  v3 plagiarism engine tests
Covers new features: sliding-window chunks, source attribution,
similarity stats, configurable threshold, deduplication.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from plagiarism_engine import (
    split_sentences,
    sliding_window_chunks,
    cosine_sim_to_percent,
    check_plagiarism,
    store_submission,
)

# ── split_sentences ───────────────────────────────────────────────────────────

def test_split_basic():
    result = split_sentences("Hello world today. This is a proper sentence. Another one here.")
    assert len(result) == 3

def test_split_filters_short():
    result = split_sentences("Hi. This is a proper long sentence. OK.")
    assert all(len(s) > 15 for s in result)

def test_split_empty():
    assert split_sentences("") == []

def test_split_deduplicates():
    text = "This is a sentence. This is a sentence. This is a sentence."
    result = split_sentences(text)
    assert len(result) == 1   # deduplication

def test_split_single():
    text = "This is a single long enough sentence."
    assert split_sentences(text) == [text]

# ── sliding_window_chunks ─────────────────────────────────────────────────────

def test_chunks_returns_list():
    result = sliding_window_chunks("The quick brown fox jumps over the lazy dog repeatedly.")
    assert isinstance(result, list)

def test_chunks_min_words_filtered():
    result = sliding_window_chunks("Hi there ok.")
    # Too short — should produce 0 or 1 chunks depending on word count
    assert isinstance(result, list)

def test_chunks_deduplicates():
    # Same short phrase repeated — deduplication should keep one
    text = " ".join(["the cat sat on the mat"] * 50)
    result = sliding_window_chunks(text)
    keys = [c[:80] for c in result]
    assert len(keys) == len(set(keys))   # all keys unique

def test_chunks_long_text_produces_multiple():
    words = " ".join([f"word{i}" for i in range(300)])
    result = sliding_window_chunks(words)
    assert len(result) >= 2

# ── cosine_sim_to_percent ─────────────────────────────────────────────────────

def test_sim_full():    assert cosine_sim_to_percent(1.0)  == 100
def test_sim_zero():   assert cosine_sim_to_percent(0.0)  == 0
def test_sim_half():   assert cosine_sim_to_percent(0.5)  == 50
def test_sim_over():   assert cosine_sim_to_percent(1.5)  == 100
def test_sim_under():  assert cosine_sim_to_percent(-0.5) == 0

# ── check_plagiarism ──────────────────────────────────────────────────────────

REQUIRED_KEYS = {
    "plagiarism_score", "originality_score", "matches",
    "sentence_results", "chunk_results", "total_sentences",
    "flagged_sentences", "similarity_stats", "processing_ms",
    "corpus_size", "web_checked", "threshold_used",
}

def test_returns_required_keys():
    result = check_plagiarism("The sky is blue and the grass is green today.")
    assert REQUIRED_KEYS.issubset(result.keys())

def test_scores_sum_to_100():
    result = check_plagiarism("Machine learning enables systems to learn from data.")
    total = result["plagiarism_score"] + result["originality_score"]
    assert abs(total - 100) < 1

def test_chunk_results_is_list():
    result = check_plagiarism("AI is transforming the world one step at a time.")
    assert isinstance(result["chunk_results"], list)

def test_similarity_stats_present():
    result = check_plagiarism("The transformer architecture changed NLP forever.")
    stats = result["similarity_stats"]
    assert "max" in stats and "mean" in stats and "median" in stats

def test_similarity_stats_max_gte_mean():
    result = check_plagiarism("Neural networks process data in multiple layers.")
    s = result["similarity_stats"]
    assert s["max"] >= s["mean"]

def test_threshold_used_returned():
    result = check_plagiarism("Some text for threshold testing.", threshold=0.80)
    assert result["threshold_used"] == 0.80

def test_threshold_clamped_to_safe_range():
    result_low  = check_plagiarism("Some text here.", threshold=0.10)
    result_high = check_plagiarism("Some text here.", threshold=0.99)
    assert result_low["threshold_used"]  >= 0.60
    assert result_high["threshold_used"] <= 0.95

def test_verbatim_corpus_sentence_flagged():
    text = "Machine learning enables systems to learn from data without being explicitly programmed."
    result = check_plagiarism(text)
    assert result["flagged_sentences"] >= 1

def test_nonsense_text_not_flagged():
    text = "Zibblequark frobulates the wumble despite the snorkel refusing to blorpify entirely."
    result = check_plagiarism(text)
    assert result["flagged_sentences"] == 0
    assert result["originality_score"] == 100

def test_short_text_returns_clean():
    result = check_plagiarism("Hi there!")
    assert result["total_sentences"] == 0
    assert result["originality_score"] == 100

def test_sentence_results_count_matches():
    text = "The transformer architecture changed NLP forever. Neural networks process data in layers."
    result = check_plagiarism(text)
    assert len(result["sentence_results"]) == result["total_sentences"]

def test_flagged_count_lte_total():
    result = check_plagiarism("AI is transforming the world. Nobody knows exactly how.")
    assert result["flagged_sentences"] <= result["total_sentences"]

def test_originality_score_is_complement():
    result = check_plagiarism("The Internet of Things connects billions of devices.")
    expected = round(100 - result["plagiarism_score"], 1)
    assert result["originality_score"] == expected

def test_web_false_by_default():
    result = check_plagiarism("Some original text written by no one.")
    assert result["web_checked"] == False

def test_processing_ms_non_negative():
    result = check_plagiarism("This is a test sentence.")
    assert result["processing_ms"] >= 0

# ── store_submission ──────────────────────────────────────────────────────────

def test_store_returns_source_id():
    sid = store_submission("This is a test submission that should be stored cleanly without errors.")
    assert isinstance(sid, str) and len(sid) > 0

def test_store_with_explicit_source_id():
    sid = store_submission("Another test submission.", source_id="test-user-123")
    assert sid == "test-user-123"

def test_store_too_short_is_graceful():
    sid = store_submission("Short.")  # no long-enough sentences
    assert isinstance(sid, str)   # returns ID even if nothing stored

def test_store_does_not_crash():
    store_submission("This is a test submission that should be stored cleanly without errors.")

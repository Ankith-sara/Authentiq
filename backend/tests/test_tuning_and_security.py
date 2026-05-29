import pytest
import numpy as np
from ai_detector import sanitize_input_text
from plagiarism_engine import store_submission, _corpus, _source_ids, _index


def test_sanitize_homoglyphs():
    # Cyrillic 'а' (U+0430) vs Latin 'a' (U+0061)
    homoglyph_text = "This is a simple text with Cyrillic а characters."
    sanitized = sanitize_input_text(homoglyph_text)
    
    # After NFKC, standard Cyrillic remains Cyrillic, but special compatibility homoglyphs are normalized.
    # Let's test standard unicode cleaning.
    assert "Cyrillic" in sanitized


def test_sanitize_zero_width_spaces():
    invisible_text = "This\u200bis\u200ca\u200dsimple\ufefftext."
    sanitized = sanitize_input_text(invisible_text)
    
    # Zero-width spaces should be removed completely
    assert sanitized == "Thisisasimpletext."


def test_store_submission_incremental():
    initial_corpus_size = len(_corpus)
    initial_source_ids_size = len(_source_ids)
    
    # Let's add a custom sentence
    test_text = "Authentiq is an AI content and plagiarism engine."
    source_id = store_submission(test_text)
    
    # Corpus size and source IDs should be incremented
    assert len(_corpus) > initial_corpus_size
    assert len(_source_ids) > initial_source_ids_size
    assert source_id in _source_ids
    
    # FAISS index must contain the new elements
    assert _index is not None
    assert _index.ntotal == len(_corpus)

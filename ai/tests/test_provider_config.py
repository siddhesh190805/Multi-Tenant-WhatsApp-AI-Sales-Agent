import os

import pytest

from app.main import _build_model


def test_openai_compatible_provider_uses_runtime_configuration(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openai-compatible")
    monkeypatch.setenv("AI_API_KEY", "runtime-test-key")
    monkeypatch.setenv("AI_MODEL", "runtime-model")
    monkeypatch.setenv("AI_BASE_URL", "https://example.test/v1")

    model = _build_model()

    assert model.model_name == "runtime-model"
    assert model.openai_api_base == "https://example.test/v1"
    assert model.openai_api_key.get_secret_value() == "runtime-test-key"


def test_gemini_provider_accepts_generic_runtime_key(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setenv("AI_API_KEY", "runtime-gemini-key")
    monkeypatch.setenv("AI_MODEL", "runtime-gemini-model")

    model = _build_model()

    assert model.model == "runtime-gemini-model"
    assert model.google_api_key.get_secret_value() == "runtime-gemini-key"


def test_unsupported_provider_fails_explicitly(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "unsupported-provider")
    monkeypatch.setenv("AI_API_KEY", "runtime-test-key")

    with pytest.raises(RuntimeError, match="Unsupported AI_PROVIDER"):
        _build_model()

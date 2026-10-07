import os

from app.main import build_graph


def test_graph_can_process_state(monkeypatch):
    monkeypatch.setenv("LLM_MODE", "mock")

    result = build_graph().invoke(
        {
            "tenant": {
                "businessName": "FitZone Gym",
                "tone": "friendly and energetic",
                "language": "English",
                "pricing": "Monthly plan Rs 1,500.",
                "faqs": [],
            },
            "messages": [
                {"direction": "in", "sender": "lead", "text": "Hi"},
            ],
            "response": "",
        }
    )

    assert "FitZone Gym" in result["response"]


def test_mock_graph_preserves_conversation_memory(monkeypatch):
    monkeypatch.setenv("LLM_MODE", "mock")

    result = build_graph().invoke(
        {
            "tenant": {
                "businessName": "FitZone Gym",
                "tone": "friendly and energetic",
                "language": "English",
                "pricing": "Monthly plan Rs 1,500.",
                "faqs": [],
            },
            "messages": [
                {"direction": "in", "sender": "lead", "text": "Mera naam Amit hai"},
                {"direction": "in", "sender": "lead", "text": "Mera naam kya hai?"},
            ],
            "response": "",
        }
    )

    assert "Amit" in result["response"]

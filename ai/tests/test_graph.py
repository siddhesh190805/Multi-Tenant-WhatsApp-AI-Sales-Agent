from app.main import build_graph


def test_graph_can_process_state():
    result = build_graph().invoke({"message": "hello", "response": ""})
    assert result["response"] == "hello"

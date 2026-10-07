from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict


class AgentState(TypedDict):
    message: str
    response: str


def respond(state: AgentState) -> AgentState:
    return {
        **state,
        "response": state["message"],
    }


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("respond", respond)
    graph.add_edge(START, "respond")
    graph.add_edge("respond", END)
    return graph.compile()

"""
Farmer chat agent — LangGraph ReAct implementation.

This is the LangGraph replacement for the hand-rolled tool-calling loop in
groq_utils.chat_with_groq(). Same tools (app/utils/langchain_tools.py, which
themselves reuse agent_tools.py's proven implementations), same RAG (via
PineconeHostedRetriever), same malformed-tool-call recovery, same
username-injection + call-dedup safety nets, same MAX_TOOL_ITERATIONS
fallback — rebuilt as an actual StateGraph instead of a manual while loop.

Public entrypoint: run_chat_agent(messages, system_prompt, max_tokens, username)
-> {"response": str, "used_tools": list, "sources": list}
This exact shape matches the old chat_with_groq() return, so callers
(app/routes/ws.py) only need to change which function they import.
"""

import json
import operator
from functools import lru_cache
from typing import Annotated, Optional, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

from app.utils.langchain_tools import CHAT_TOOLS, CHAT_TOOLS_BY_NAME
from app.utils.langchain_groq_rotation import get_rotating_chat_groq

MAX_TOOL_ITERATIONS = 3  # same cap as the old implementation


class ChatAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    username: Optional[str]
    used_tools: Annotated[list, operator.add]
    sources: Annotated[list, operator.add]
    iterations: int


def _recover_malformed_tool_call(error_str: str):
    """
    Same recovery strategy as groq_utils._recover_malformed_tool_call:
    Groq's tool-call validation error echoes back the exact mangled call
    the model tried to make (name + JSON args glued together), e.g.
        search_farming_documents{"query": "treatment for leaf scorch"}
    Recovering and running it directly beats just dropping tool access
    for the whole turn. Returns (tool_name, args_dict) or (None, None).
    """
    for name in CHAT_TOOLS_BY_NAME:
        idx = error_str.find(name + "{")
        if idx == -1:
            continue
        json_start = idx + len(name)
        try:
            args, _ = json.JSONDecoder().raw_decode(error_str[json_start:])
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(args, dict):
            return name, args
    return None, None


def _extract_error_search_text(e: Exception) -> str:
    """
    Groq's malformed-tool-call error shows up in at least two shapes:
    1. The mangled call embedded directly in the top-level error message
       (str(e) alone is enough to recover from).
    2. A generic "Failed to call a function... See 'failed_generation' for
       more details" message — here the actual mangled text (usually
       wrapped like <function=name{...}></function>) is NOT in str(e) at
       all, it's only in the raw response body's error.failed_generation
       field. groq.APIStatusError exposes that whole body via `.body`,
       so pull it in too rather than only ever searching str(e).
    """
    parts = [str(e)]
    body = getattr(e, "body", None)
    if isinstance(body, dict):
        error_obj = body.get("error")
        if isinstance(error_obj, dict):
            failed_generation = error_obj.get("failed_generation")
            if failed_generation:
                parts.append(str(failed_generation))
    return "\n".join(parts)


def _extract_sources(tool_name: str, result) -> list:
    if tool_name == "search_farming_documents" and isinstance(result, dict) and result.get("sources"):
        return list(result["sources"])
    return []


async def _agent_node(state: ChatAgentState, *, max_tokens: int) -> dict:
    model = get_rotating_chat_groq(max_tokens=max_tokens).bind_tools(CHAT_TOOLS)

    try:
        ai_msg = await model.ainvoke(state["messages"])
        return {"messages": [ai_msg]}

    except Exception as e:
        # Known Llama/Groq quirk (see groq_utils.py for the original
        # discovery of this) — the model sometimes emits a malformed
        # pseudo function call instead of a proper structured tool call,
        # and Groq's API rejects it with a 400 validation error. This
        # shows up under a couple of different message wordings, so check
        # broadly rather than one exact phrase.
        error_str = str(e)
        is_malformed_call = any(marker in error_str for marker in (
            "tool_use_failed",
            "tool call validation failed",
            "Failed to call a function",
        ))
        if not is_malformed_call:
            raise

        print(f"⚠️ Malformed tool call detected: {error_str[:150]}")
        search_text = _extract_error_search_text(e)
        recovered_name, recovered_args = _recover_malformed_tool_call(search_text)
        plain_model = get_rotating_chat_groq(max_tokens=max_tokens)  # no tools bound this time

        if recovered_name and recovered_name in CHAT_TOOLS_BY_NAME:
            print(f"   Recovered: {recovered_name}({recovered_args}) — executing directly")
            if recovered_name == "get_last_disease_detection" and "username" not in recovered_args and state.get("username"):
                recovered_args["username"] = state["username"]

            tool = CHAT_TOOLS_BY_NAME[recovered_name]
            try:
                result = await tool.ainvoke(recovered_args)
            except Exception as tool_err:
                result = {"found": False, "message": f"Tool error: {str(tool_err)}"}

            followup = HumanMessage(
                content=f"[Tool result for {recovered_name}]: {json.dumps(result)}\n\n"
                        "Use this to answer the farmer's question."
            )
            try:
                final = await plain_model.ainvoke(state["messages"] + [followup])
            except Exception as e2:
                final = AIMessage(content=f"Sorry, I had trouble answering that. ({str(e2)})")

            return {
                "messages":   [final],
                "used_tools": [recovered_name],
                "sources":    _extract_sources(recovered_name, result),
            }

        print("   Could not recover a specific tool call — answering without tools")
        try:
            final = await plain_model.ainvoke(state["messages"])
        except Exception as e2:
            final = AIMessage(content=f"Sorry, I had trouble answering that. ({str(e2)})")
        return {"messages": [final]}


async def _tools_node(state: ChatAgentState) -> dict:
    last = state["messages"][-1]
    tool_calls = getattr(last, "tool_calls", None) or []

    # Deduplicate identical tool+args calls within this one turn — safety
    # net on top of the prompt instruction, same as the old implementation.
    seen: dict = {}
    tool_messages = []
    used_tools = []
    sources = []

    for tc in tool_calls:
        name = tc["name"]
        args = dict(tc.get("args") or {})

        if name == "get_last_disease_detection" and "username" not in args and state.get("username"):
            args["username"] = state["username"]

        call_key = (name, json.dumps(args, sort_keys=True))

        if call_key in seen:
            result = seen[call_key]
        else:
            tool = CHAT_TOOLS_BY_NAME.get(name)
            if tool is None:
                result = {"found": False, "message": f"Unknown tool: {name}"}
            else:
                try:
                    result = await tool.ainvoke(args)
                except Exception as e:
                    result = {"found": False, "message": f"Tool error: {str(e)}"}
            seen[call_key] = result
            used_tools.append(name)
            sources.extend(s for s in _extract_sources(name, result) if s not in sources)

        tool_messages.append(ToolMessage(content=json.dumps(result), tool_call_id=tc["id"], name=name))

    return {
        "messages":   tool_messages,
        "used_tools": used_tools,
        "sources":    sources,
        "iterations": state.get("iterations", 0) + 1,
    }


async def _finalize_node(state: ChatAgentState, *, max_tokens: int) -> dict:
    """
    Hit MAX_TOOL_ITERATIONS with the model still wanting to call tools —
    same safety fallback as the old implementation: one last no-tools call
    so the farmer always gets a real text answer, never a silent dead end.
    """
    plain_model = get_rotating_chat_groq(max_tokens=max_tokens)
    try:
        final = await plain_model.ainvoke(state["messages"])
    except Exception as e:
        final = AIMessage(content=f"Sorry, I had trouble completing that request: {str(e)}")
    return {"messages": [final]}


def _route_after_agent(state: ChatAgentState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        if state.get("iterations", 0) < MAX_TOOL_ITERATIONS:
            return "tools"
        return "finalize"
    return END


@lru_cache(maxsize=8)
def _build_graph(max_tokens: int):
    """Compiled graphs are cheap to build (no network call) and reusable —
    cached per max_tokens value since that's the only thing that varies
    between calls in practice."""
    graph = StateGraph(ChatAgentState)

    async def agent_node(state):
        return await _agent_node(state, max_tokens=max_tokens)

    async def finalize_node(state):
        return await _finalize_node(state, max_tokens=max_tokens)

    graph.add_node("agent", agent_node)
    graph.add_node("tools", _tools_node)
    graph.add_node("finalize", finalize_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", _route_after_agent, {"tools": "tools", "finalize": "finalize", END: END})
    graph.add_edge("tools", "agent")
    graph.add_edge("finalize", END)

    return graph.compile()


async def run_chat_agent(
    messages: list,
    system_prompt: str,
    max_tokens: int = 600,
    username: Optional[str] = None,
) -> dict:
    """
    Drop-in replacement for groq_utils.chat_with_groq() — same signature,
    same return shape ({"response", "used_tools", "sources"}), so ws.py
    only needs to change its import, not its calling code.

    `messages` is the same Mongo-loaded history shape used before:
    a list of {"role": "user"|"assistant", "content": str} dicts.
    """
    lc_messages = [SystemMessage(content=system_prompt)]
    for m in messages:
        role = m.get("role")
        content = m.get("content", "")
        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))

    initial_state: ChatAgentState = {
        "messages":   lc_messages,
        "username":   username,
        "used_tools": [],
        "sources":    [],
        "iterations": 0,
    }

    graph = _build_graph(max_tokens)
    final_state = await graph.ainvoke(initial_state, config={"recursion_limit": 50})

    last = final_state["messages"][-1]
    text = (getattr(last, "content", "") or "").strip().replace("\\n", "\n")

    return {
        "response":   text,
        "used_tools": final_state.get("used_tools", []),
        "sources":    final_state.get("sources", []),
    }
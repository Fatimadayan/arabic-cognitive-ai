from typing import Optional, List

from app.core.agent_config import AGENT_MODELS
from app.core.config import PRIMARY_MODEL
from app.services.agent import build_agent_prompt, build_ollama_messages, ollama_blocking
from app.services.verification import verify_agent_output


async def execute_agent(
        agent_id: str,
        query: str,
        prev_context: str = "",
        rag_ctx: str = "",
        message_history: Optional[List[dict]] = None,
    ) -> str:
    model = AGENT_MODELS.get(agent_id, PRIMARY_MODEL)
    system, prompt = await build_agent_prompt(
        agent_id=agent_id,
        query=query,
        prev_context=prev_context,
        rag_ctx=rag_ctx,
    )
    messages = build_ollama_messages(
        system=system,
        prompt=prompt,
        message_history=message_history,
    )

    response = ollama_blocking(model=model, messages=messages)
    if not response:
        return f"[خطأ] فشل تنفيذ الوكيل {agent_id}"

    verification = verify_agent_output(agent_id, response)
    if verification.get("confidence", 0) < 0.25:
        return f"[تحذير] الرد من {agent_id} جاء بثقة منخفضة. {response}"

    return response

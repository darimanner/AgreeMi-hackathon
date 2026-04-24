from pydantic import BaseModel


class ChatRequest(BaseModel):
    data: dict
    model: str = "meta-llama/llama-3-8b-instruct:free"


class ChatResponse(BaseModel):
    result: str

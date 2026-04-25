from enum import StrEnum

from pydantic import BaseModel, Field


class FindingSeverity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class Finding(BaseModel):
    id: str = Field(..., description="Unique finding identifier, e.g. FINDING-1")
    severity: FindingSeverity
    title: str
    explanation: str
    recommendation: str
    quote: str = Field(..., description="Exact excerpt from document_markdown")
    start_line: int
    end_line: int


class AnalysisResult(BaseModel):
    """Structured output stored in Chat.ai_analysis_json."""

    score: int = Field(..., ge=0, le=100, description="Overall quality score 0-100")
    document_markdown: str = Field(
        default="", description="Clean markdown version of the source document"
    )
    analysis_markdown: str = Field(
        ..., description="Human-readable review with summary and risks"
    )
    findings: list[Finding] = Field(default_factory=list)

from enum import StrEnum
from typing import Literal

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


FindingChangeType = Literal[
    "added", "removed", "severity_changed", "worsened", "improved", "unchanged"
]


class FindingChange(BaseModel):
    change: FindingChangeType
    title: str
    old_severity: FindingSeverity | None = None
    new_severity: FindingSeverity | None = None
    explanation: str = Field(..., description="What changed and why it matters")


class DiffResult(BaseModel):
    """Structured output for /diff command."""

    old_version: int
    new_version: int
    old_score: int
    new_score: int
    score_delta: int = Field(..., description="new_score - old_score (signed)")
    summary: str = Field(
        ..., description="2-4 sentences describing overall progress or regression"
    )
    changes: list[FindingChange] = Field(default_factory=list)


class AnalysisSummaryResponse(BaseModel):
    """Response for POST /chats/{chat_id}/analysis/summary."""

    summary: str
    version: int
    score: int

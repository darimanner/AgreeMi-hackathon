from enum import StrEnum

from pydantic import BaseModel, Field


class IssueSeverity(StrEnum):
    """Severity level of an identified issue."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AnalysisIssue(BaseModel):
    """A single issue identified during document analysis."""

    id: str = Field(..., description="Unique issue identifier, e.g. ISSUE-1")
    severity: IssueSeverity
    title: str
    description: str
    suggestion: str


class AnalysisResult(BaseModel):
    """Structured output returned by the GPT-4o analysis service.

    Stored in Chat.ai_analysis_json and broadcast as part of the /analyze
    command response.
    """

    score: int = Field(..., ge=0, le=100, description="Overall quality score 0-100")
    summary: str
    issues: list[AnalysisIssue] = Field(default_factory=list)

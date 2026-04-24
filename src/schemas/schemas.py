from pydantic import BaseModel, Field


class AnalyzePDFResponse(BaseModel):
    markdown_content: str = Field(description="PDF converted to Markdown")
    analysis: str = Field(description="AI analysis result in Markdown")
    filename: str
    pages_processed: int
    model: str

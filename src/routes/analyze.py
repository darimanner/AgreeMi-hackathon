import io

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from markitdown import MarkItDown

from clients.openrouter import analyze_pdf_markdown
from core.logger import logger
from schemas.schemas import AnalyzePDFResponse

router = APIRouter()

_md_converter = MarkItDown()


@router.post("/pdf", response_model=AnalyzePDFResponse)
async def analyze_pdf(
    file: UploadFile = File(..., description="PDF file to analyze"),
    prompt: str | None = Form(None, description="Optional question or instruction"),
    model: str = Form(
        "meta-llama/llama-3.3-8b-instruct:free",
        description="OpenRouter model ID",
    ),
) -> AnalyzePDFResponse:
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail=f"Expected application/pdf, got {file.content_type}",
        )

    content = await file.read()
    logger.info("Converting PDF to Markdown", filename=file.filename, size=len(content))

    try:
        result = _md_converter.convert_stream(
            io.BytesIO(content),
            file_extension=".pdf",
        )
        markdown_content = result.text_content
    except Exception as e:
        logger.error("Failed to convert PDF", error=str(e))
        raise HTTPException(status_code=422, detail="Could not parse PDF file") from e

    if not markdown_content.strip():
        raise HTTPException(
            status_code=422,
            detail="PDF contains no extractable text",
        )

    pages_processed = markdown_content.count("\f") + 1

    logger.info("Sending to OpenRouter for analysis", model=model)
    try:
        analysis, model_used = await analyze_pdf_markdown(
            markdown_content=markdown_content,
            user_prompt=prompt,
            model=model,
        )
    except Exception as e:
        logger.error("OpenRouter analysis failed", error=str(e))
        raise HTTPException(status_code=502, detail="AI analysis failed") from e

    return AnalyzePDFResponse(
        markdown_content=markdown_content,
        analysis=analysis,
        filename=file.filename or "unknown.pdf",
        pages_processed=pages_processed,
        model=model_used,
    )

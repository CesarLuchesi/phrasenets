# main.py

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional
from phrase_net_core import run_phrase_net_analysis
from utils import extract_text_from_source
import io
import uvicorn
import json

app = FastAPI(
    title="Phrase Net Backend",
    description="API for text analysis with Phrase Nets (3.1, 3.2, 3.3).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def validate_linking_params(
    linking_type: str = Form(
        "orthographic", description="Linking method: 'orthographic' or 'syntactic'."
    ),
    pattern: Optional[str] = Form(
        None,
        description=r"Regex Pattern (required for Orthographic Linking). Ex: r'(\w+)\s+(and)\s+(\w+)'",
    ),
):
    valid_types = {"orthographic", "syntactic"}

    if linking_type not in valid_types:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid linking type: '{linking_type}'. Use 'orthographic' or 'syntactic'.",
        )

    if linking_type == "orthographic" and not pattern:
        raise HTTPException(
            status_code=400,
            detail="Orthographic Linking requires the 'pattern' field (regex) to be filled.",
        )

    if linking_type == "syntactic" and pattern:
        print(
            "Warning: The pattern will be ignored, as Syntactic Linking uses the dependency parser."
        )

    return {"linking_type": linking_type, "pattern": pattern}


@app.get("/analysis/text")
async def get_analysis_text():
    try:
        if hasattr(get_analysis_text, "last_text"):
            return {
                "status": "success",
                "text": get_analysis_text.last_text,
                "length": len(get_analysis_text.last_text),
            }
        else:
            raise HTTPException(
                status_code=404, detail="Nenhum texto foi analisado ainda"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao recuperar texto: {e}")


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_text(
    file: Optional[UploadFile] = File(
        None, description="PDF or TXT file for analysis."
    ),
    text_content: Optional[str] = Form(
        None, description="Direct text snippet for analysis."
    ),
    linking_params: dict = Depends(validate_linking_params),
    max_nodes: int = Form(
        100,
        description="Maximum number of nodes to retain after filtering (Section 3.2).",
    ),
    hidden_words: Optional[str] = Form("[]"),
):

    raw_text = ""

    if text_content:
        raw_text = text_content
    elif file:
        try:
            file_stream = io.BytesIO(await file.read())
            raw_text = await extract_text_from_source(file_stream, file.filename)
        except IOError as e:
            raise HTTPException(status_code=422, detail=str(e))
    else:
        raise HTTPException(
            status_code=400, detail="No file or text snippet was provided."
        )

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="The extracted text is empty.")
    get_analysis_text.last_text = raw_text

    try:
        stopwords_list = json.loads(hidden_words) if hidden_words else []
    except:
        stopwords_list = []

    try:
        result = run_phrase_net_analysis(
            raw_text=raw_text,
            linking_type=linking_params["linking_type"],
            pattern=linking_params["pattern"],
            max_nodes=max_nodes,
            stopwords=stopwords_list,
        )

        return {"status": "success", "analysis_result": result}

    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"NLP dependency error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing Phrase Net: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)

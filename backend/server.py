"""FaZes - Backend
Parses work-schedule PDFs and returns structured employee data.

Two strategies:
1. Text-based PDFs (pdfplumber) - fast, works with the classic SATA format.
2. Image/scanned PDFs (Gemini vision via emergentintegrations) - handles any
   rasterised / non-selectable-text PDF (e.g. OAES exports from macOS Preview).

Stateless service: no DB writes (all persistence is client-side localStorage).
"""
from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import re
import io
import json
import uuid
import base64
import asyncio
import logging
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
import pdfplumber
import pypdfium2 as pdfium

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

app = FastAPI(title="FaZes API")
api_router = APIRouter(prefix="/api")

# ---------- Models ----------
class DayCell(BaseModel):
    day: int
    weekday: Optional[str] = None  # "2","3","4","5","6","S","D"
    code: str

class Employee(BaseModel):
    row: int
    employee_id: str
    name: str
    days: List[DayCell]

class ParseResult(BaseModel):
    month: Optional[int] = None
    year: Optional[int] = None
    title: Optional[str] = None
    employees: List[Employee]
    raw_codes: List[str]


# ---------- Helpers ----------
MONTH_TOKENS = {
    "JAN": 1, "FEV": 2, "MAR": 3, "ABR": 4, "MAI": 5, "JUN": 6,
    "JUL": 7, "AGO": 8, "SET": 9, "OUT": 10, "NOV": 11, "DEZ": 12,
}

def detect_month_year(text: str, filename: str = "") -> tuple[Optional[int], Optional[int]]:
    """Detect month/year from PDF text or filename."""
    haystack = f"{filename} {text}".upper()

    m = re.search(r"(20\d{2})\s*0?(\d{1,2})\s*[-_ ]?\s*(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)", haystack)
    if m:
        return MONTH_TOKENS[m.group(3)], int(m.group(1))

    m = re.search(r"(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\D{0,5}(20\d{2})", haystack)
    if m:
        return MONTH_TOKENS[m.group(1)], int(m.group(2))

    m = re.search(r"(20\d{2})", haystack)
    year = int(m.group(1)) if m else None
    return None, year


def _group_words_into_lines(words, y_tol: float = 3.0):
    """Group pdfplumber word dicts into rows by their `top` position."""
    lines = []
    for w in sorted(words, key=lambda x: (x["top"], x["x0"])):
        placed = False
        for line in lines:
            if abs(line["top"] - w["top"]) <= y_tol:
                line["words"].append(w)
                line["top"] = (line["top"] * (len(line["words"]) - 1) + w["top"]) / len(line["words"])
                placed = True
                break
        if not placed:
            lines.append({"top": w["top"], "words": [w]})
    for ln in lines:
        ln["words"].sort(key=lambda x: x["x0"])
    lines.sort(key=lambda ln: ln["top"])
    return lines


# Accept generic numeric IDs (4-10 digits), not just SATA's 5XXXXXXX prefix.
EMPLOYEE_RE = re.compile(r"^(\d{4,10})\s*[-–—]\s*(.+)$")


def parse_schedule_pdf_text(pdf_bytes: bytes, filename: str = "") -> ParseResult:
    """Text-based parser (pdfplumber). Only works when the PDF has selectable text."""
    employees: List[Employee] = []
    raw_codes_set: set[str] = set()
    title = filename
    full_text = ""

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            full_text += page_text + "\n"
            words = page.extract_words(extra_attrs=["size"])
            if not words:
                continue
            lines = _group_words_into_lines(words, y_tol=4.0)

            day_header_idx = None
            day_positions: list[tuple[int, float]] = []
            for i, ln in enumerate(lines):
                ints: list[tuple[int, float]] = []
                for w in ln["words"]:
                    t = w["text"].strip()
                    if t.isdigit():
                        v = int(t)
                        if 1 <= v <= 31:
                            ints.append((v, (w["x0"] + w["x1"]) / 2))
                if len(ints) >= 10:
                    seq = [v for v, _ in ints]
                    inc = sum(1 for a, b in zip(seq, seq[1:]) if b == a + 1 or b == a)
                    if inc >= len(seq) - 3:
                        day_header_idx = i
                        day_positions = ints
                        break

            if day_header_idx is None or not day_positions:
                continue

            weekday_map: dict[int, str] = {}
            if day_header_idx > 0:
                wk_line = lines[day_header_idx - 1]
                for d, x in day_positions:
                    nearest = min(
                        wk_line["words"],
                        key=lambda w: abs((w["x0"] + w["x1"]) / 2 - x),
                        default=None,
                    )
                    if nearest is not None:
                        t = nearest["text"].strip().upper()
                        if t in {"S", "D", "2", "3", "4", "5", "6", "T", "Q"}:
                            weekday_map[d] = t

            for ln in lines[day_header_idx + 1:]:
                row_text = " ".join(w["text"] for w in ln["words"]).strip()
                emp_match = EMPLOYEE_RE.match(row_text)
                if not emp_match:
                    continue

                emp_id = emp_match.group(1)
                first_day_x = day_positions[0][1]
                name_words = []
                code_words = []
                col_width = (
                    (day_positions[1][1] - day_positions[0][1])
                    if len(day_positions) > 1
                    else 20
                )
                cutoff_x = first_day_x - col_width * 0.6
                for w in ln["words"]:
                    if w["x0"] < cutoff_x:
                        name_words.append(w)
                    else:
                        code_words.append(w)
                name_text = " ".join(w["text"] for w in name_words)
                name_clean = re.sub(r"^\d{4,10}\s*[-–—]\s*", "", name_text).strip()

                day_to_code: dict[int, str] = {}
                for w in code_words:
                    cx = (w["x0"] + w["x1"]) / 2
                    nearest_day, _ = min(day_positions, key=lambda p: abs(p[1] - cx))
                    txt = w["text"].strip()
                    if not txt or txt.isspace():
                        continue
                    if nearest_day in day_to_code:
                        day_to_code[nearest_day] = day_to_code[nearest_day] + txt
                    else:
                        day_to_code[nearest_day] = txt

                days: list[DayCell] = []
                for d, _x in day_positions:
                    code = day_to_code.get(d, "").strip()
                    if code:
                        raw_codes_set.add(code)
                    days.append(
                        DayCell(day=d, weekday=weekday_map.get(d), code=code)
                    )

                employees.append(
                    Employee(
                        row=len(employees) + 1,
                        employee_id=emp_id,
                        name=name_clean or emp_id,
                        days=days,
                    )
                )

    month, year = detect_month_year(full_text, filename)
    return ParseResult(
        month=month,
        year=year,
        title=title,
        employees=employees,
        raw_codes=sorted(raw_codes_set),
    )


# ---------- Vision (Gemini) fallback for image-based PDFs ----------

def _render_pdf_pages_to_jpeg(pdf_bytes: bytes, dpi: int = 140) -> list[bytes]:
    """Render each PDF page to JPEG bytes using pypdfium2 (smaller/faster than PNG)."""
    imgs: list[bytes] = []
    doc = pdfium.PdfDocument(pdf_bytes)
    try:
        scale = dpi / 72.0
        for page in doc:
            pil = page.render(scale=scale).to_pil()
            # Cap dimensions so payload stays small (faster vision inference).
            max_side = 1700
            if max(pil.size) > max_side:
                ratio = max_side / max(pil.size)
                new_size = (int(pil.size[0] * ratio), int(pil.size[1] * ratio))
                pil = pil.resize(new_size)
            buf = io.BytesIO()
            pil.convert("RGB").save(buf, format="JPEG", quality=85, optimize=True)
            imgs.append(buf.getvalue())
            page.close()
    finally:
        doc.close()
    return imgs


VISION_PROMPT = """Estás a olhar para UMA página de uma escala mensal de trabalho.
Extrai os funcionários visíveis nesta página em JSON válido.

Formato de saída OBRIGATÓRIO (JSON puro, sem markdown, sem comentários):
{
  "month": <int 1-12 ou null>,
  "year": <int ou null>,
  "employees": [
    {
      "employee_id": "<número do funcionário>",
      "name": "<nome completo>",
      "days": {"1": "<código>", "2": "<código>", ...}
    }
  ]
}

Regras:
- Cada funcionário: linha com "NNNNNNNN - Nome Apelido" (ou "NNNNNNNN- Nome Apelido").
- Para cada dia (colunas 1..28/29/30/31), lê o código EXATO (ex: "M14","T6A","IT2","D","F","102","796","P24","M96","FCD","M15").
- Se a célula está vazia, omite a chave (não uses "").
- Não inventes códigos. Não juntes códigos de células diferentes.
- Não incluas linhas de totais, legendas, cabeçalhos, assinaturas.
- Se esta página não tem funcionários (só legenda/totais), devolve employees: [].
- Detecta mês/ano do título (ex: "SETEMBRO 2026" -> month=9, year=2026).

Devolve APENAS o JSON, começando por { e acabando em }."""


async def _extract_one_page(api_key: str, image_bytes: bytes, page_no: int, filename: str) -> dict:
    """Send one page image to Gemini vision and return parsed JSON dict."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(
        api_key=api_key,
        session_id=f"parse-{filename or 'pdf'}-p{page_no}",
        system_message=(
            "És um extractor de dados tabulares. Devolves sempre JSON válido, "
            "sem texto extra, sem markdown, sem ```."
        ),
    ).with_model("gemini", "gemini-3-flash-preview")

    img = ImageContent(image_base64=base64.b64encode(image_bytes).decode("ascii"))
    user_message = UserMessage(text=VISION_PROMPT, file_contents=[img])
    raw = await chat.send_message(user_message)
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z0-9]*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise RuntimeError(f"Resposta sem JSON (p{page_no}): {text[:200]}")
    return json.loads(text[start:end + 1])


async def parse_schedule_pdf_vision(pdf_bytes: bytes, filename: str = "") -> ParseResult:
    """Vision-based parser using Gemini. Handles image/scanned PDFs.
    Processes pages sequentially (Emergent LLM key blocks parallel calls)."""

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY não configurada no backend.")

    pages = _render_pdf_pages_to_jpeg(pdf_bytes, dpi=140)
    if not pages:
        raise RuntimeError("Não foi possível renderizar as páginas do PDF.")

    results: list = []
    for i, img in enumerate(pages):
        try:
            r = await _extract_one_page(api_key, img, i + 1, filename)
            results.append(r)
        except Exception as exc:
            logging.warning("Vision page %s failed: %s", i + 1, exc)
            results.append(exc)

    # Merge pages: collect employees across all pages, dedupe by employee_id.
    month: Optional[int] = None
    year: Optional[int] = None
    merged: "dict[str, dict]" = {}  # employee_id -> {name, days_map}
    order: list[str] = []
    for r in results:
        if isinstance(r, Exception):
            logging.warning("Vision page failed: %s", r)
            continue
        month = month or r.get("month")
        year = year or r.get("year")
        for emp in r.get("employees") or []:
            emp_id = str(emp.get("employee_id") or "").strip()
            if not emp_id:
                continue
            name = str(emp.get("name") or "").strip() or emp_id
            days_map = emp.get("days") or {}
            if isinstance(days_map, list):
                tmp = {}
                for cell in days_map:
                    if isinstance(cell, dict) and "day" in cell:
                        tmp[str(cell["day"])] = str(cell.get("code") or "")
                days_map = tmp
            if emp_id not in merged:
                merged[emp_id] = {"name": name, "days": {}}
                order.append(emp_id)
            existing = merged[emp_id]["days"]
            for k, v in days_map.items():
                code = str(v or "").strip()
                if code and not existing.get(str(k)):
                    existing[str(k)] = code

    if not year:
        _m, _y = detect_month_year("", filename)
        month = month or _m
        year = year or _y

    def _days_in_month(m: Optional[int], y: Optional[int]) -> int:
        if not m or not y:
            return 31
        from calendar import monthrange
        return monthrange(y, m)[1]
    total_days = _days_in_month(month, year)

    employees: List[Employee] = []
    raw_codes_set: set[str] = set()
    for i, emp_id in enumerate(order):
        info = merged[emp_id]
        days_map = info["days"]
        days: list[DayCell] = []
        for d in range(1, total_days + 1):
            code = str(days_map.get(str(d), "") or "").strip()
            if code:
                raw_codes_set.add(code)
            days.append(DayCell(day=d, weekday=None, code=code))
        employees.append(
            Employee(
                row=i + 1,
                employee_id=emp_id,
                name=info["name"],
                days=days,
            )
        )

    return ParseResult(
        month=month,
        year=year,
        title=filename,
        employees=employees,
        raw_codes=sorted(raw_codes_set),
    )


# ---------- Async job store ----------
# In-memory store of long-running parse jobs. The Kubernetes ingress caps HTTP
# requests around 60s, but the vision fallback needs longer, so we return a
# job id immediately and let the frontend poll for the result.
_JOBS: "dict[str, dict]" = {}
_JOB_TTL_SECONDS = 60 * 30  # 30 minutes

def _reap_jobs():
    import time
    now = time.time()
    dead = [k for k, v in _JOBS.items() if now - v.get("created_at", now) > _JOB_TTL_SECONDS]
    for k in dead:
        _JOBS.pop(k, None)


async def _run_parse_job(job_id: str, data: bytes, filename: str):
    try:
        # pdfplumber is CPU-bound, run in a thread so it doesn't block the loop.
        text_result: Optional[ParseResult] = None
        try:
            text_result = await asyncio.to_thread(parse_schedule_pdf_text, data, filename)
        except Exception:
            logging.exception("Text-based parse failed inside job %s", job_id)
        if text_result and text_result.employees:
            _JOBS[job_id]["status"] = "done"
            _JOBS[job_id]["result"] = text_result.model_dump()
            return
        vision_result = await parse_schedule_pdf_vision(data, filename=filename)
        if not vision_result.employees:
            _JOBS[job_id]["status"] = "error"
            _JOBS[job_id]["error"] = (
                "Não foram detetados funcionários no PDF, mesmo com OCR. Confirma o ficheiro."
            )
            return
        _JOBS[job_id]["status"] = "done"
        _JOBS[job_id]["result"] = vision_result.model_dump()
    except Exception as exc:
        logging.exception("Parse job %s failed", job_id)
        _JOBS[job_id]["status"] = "error"
        _JOBS[job_id]["error"] = str(exc)


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"service": "FaZes API", "status": "ok"}


@api_router.post("/parse-schedule")
async def parse_schedule(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Por favor envia um ficheiro PDF.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Ficheiro vazio.")

    # Everything happens in a background job; caller polls /parse-schedule/{job_id}.
    import time
    _reap_jobs()
    job_id = uuid.uuid4().hex
    _JOBS[job_id] = {"status": "pending", "created_at": time.time()}
    asyncio.create_task(_run_parse_job(job_id, data, file.filename or ""))
    return JSONResponse({"status": "pending", "job_id": job_id})


@api_router.get("/parse-schedule/{job_id}")
async def parse_schedule_status(job_id: str):
    _reap_jobs()
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job desconhecido ou expirado.")
    if job["status"] == "done":
        return JSONResponse({"status": "done", "result": job["result"]})
    if job["status"] == "error":
        return JSONResponse({"status": "error", "detail": job.get("error", "Erro desconhecido.")})
    return JSONResponse({"status": "pending"})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

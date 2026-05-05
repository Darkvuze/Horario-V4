"""FaZes - Backend
Parses Sata-style work-schedule PDFs and returns structured employee data.
Stateless service: no DB writes (all persistence is client-side localStorage).
"""
from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import re
import io
import logging
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
import pdfplumber

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

    # filename pattern: "2026043-MAI"  -> year 2026, month MAI(5)
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


EMPLOYEE_RE = re.compile(r"^(5\d{7})\s*[-–]\s*(.+)$")


def parse_schedule_pdf(pdf_bytes: bytes, filename: str = "") -> ParseResult:
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

            # Find the day-number header line: a line whose tokens are mostly small
            # integers in the range 1..31 and contains many of them.
            day_header_idx = None
            day_positions: list[tuple[int, float]] = []  # (day, x_center)
            for i, ln in enumerate(lines):
                ints: list[tuple[int, float]] = []
                for w in ln["words"]:
                    t = w["text"].strip()
                    if t.isdigit():
                        v = int(t)
                        if 1 <= v <= 31:
                            ints.append((v, (w["x0"] + w["x1"]) / 2))
                # Looking for a line of mostly increasing day numbers (>=10 of them)
                if len(ints) >= 10:
                    seq = [v for v, _ in ints]
                    inc = sum(1 for a, b in zip(seq, seq[1:]) if b == a + 1 or b == a)
                    if inc >= len(seq) - 3:
                        day_header_idx = i
                        day_positions = ints
                        break

            if day_header_idx is None or not day_positions:
                continue

            # Try the immediately preceding row as weekday header (S, D, 2..6)
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
                        if t in {"S", "D", "2", "3", "4", "5", "6"}:
                            weekday_map[d] = t

            # Iterate over data rows after the header
            for ln in lines[day_header_idx + 1:]:
                # Recombine words to detect "ID - Name" prefix (which may span words)
                row_text = " ".join(w["text"] for w in ln["words"]).strip()
                emp_match = EMPLOYEE_RE.match(row_text)
                if not emp_match:
                    continue

                emp_id = emp_match.group(1)
                # Find where the name ends (last word before first day cell starts)
                first_day_x = day_positions[0][1]
                name_words = []
                code_words = []
                # ID + dash + name words sit at x < first_day_x - half_col_width
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
                # Strip "5XXXXXXX -"
                name_clean = re.sub(r"^5\d{7}\s*[-–]\s*", "", name_text).strip()

                # Assign code_words to nearest day column
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


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"service": "FaZes API", "status": "ok"}


@api_router.post("/parse-schedule", response_model=ParseResult)
async def parse_schedule(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Por favor envia um ficheiro PDF.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Ficheiro vazio.")
    try:
        result = parse_schedule_pdf(data, filename=file.filename)
    except Exception as exc:  # pragma: no cover - defensive
        logging.exception("PDF parse failed")
        raise HTTPException(status_code=422, detail=f"Falha ao ler o PDF: {exc}") from exc
    if not result.employees:
        raise HTTPException(
            status_code=422,
            detail="Não foram detetados funcionários no PDF. Confirma o formato.",
        )
    return result


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

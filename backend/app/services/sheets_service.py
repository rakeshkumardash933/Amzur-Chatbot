"""
Spreadsheet loading service.
Supports CSV, XLSX, and Google Sheets -> pandas.DataFrame conversion.
"""
from __future__ import annotations

import io
import json
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlparse

import gspread
import pandas as pd

from app.core.config import settings


_SHEET_ID_PATTERN = re.compile(r"/spreadsheets/d/([a-zA-Z0-9-_]+)")


class SheetsServiceError(Exception):
    """Raised for spreadsheet loading or parsing errors."""


@dataclass
class SpreadsheetLoadResult:
    """Structured result for loaded spreadsheet content."""

    dataframe: pd.DataFrame
    source_name: str
    worksheet_name: str | None = None
    worksheet_names: list[str] | None = None


def _normalize_headers(headers: list[str], width: int) -> list[str]:
    safe_headers: list[str] = []
    seen: dict[str, int] = {}

    for i in range(width):
        raw = headers[i] if i < len(headers) else ""
        base = (raw or "").strip() or f"column_{i + 1}"
        count = seen.get(base, 0)
        seen[base] = count + 1
        safe_headers.append(base if count == 0 else f"{base}_{count + 1}")

    return safe_headers


def _get_service_account_info() -> dict[str, Any]:
    raw = settings.GOOGLE_SERVICE_ACCOUNT_JSON
    if not raw:
        raise SheetsServiceError("GOOGLE_SERVICE_ACCOUNT_JSON is not configured")

    try:
        info = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SheetsServiceError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON") from exc

    if "client_email" not in info or "private_key" not in info:
        raise SheetsServiceError("Service account JSON is missing required fields")

    return info


def _get_gspread_client() -> gspread.Client:
    info = _get_service_account_info()
    # Required: service_account_from_dict (non-deprecated)
    return gspread.service_account_from_dict(info)


def extract_spreadsheet_id(sheet_url: str) -> str:
    """Extract Google spreadsheet ID from URL."""
    match = _SHEET_ID_PATTERN.search(sheet_url)
    if match:
        return match.group(1)

    parsed = urlparse(sheet_url)
    if parsed.netloc.endswith("docs.google.com") and parsed.path:
        path_bits = [p for p in parsed.path.split("/") if p]
        if len(path_bits) >= 3 and path_bits[0] == "spreadsheets" and path_bits[1] == "d":
            return path_bits[2]

    raise SheetsServiceError("Malformed Google Sheet URL")


def _worksheet_gid_from_url(sheet_url: str) -> str | None:
    parsed = urlparse(sheet_url)

    if parsed.fragment.startswith("gid="):
        return parsed.fragment.replace("gid=", "", 1)

    qs = parse_qs(parsed.query)
    gid_values = qs.get("gid")
    if gid_values:
        return gid_values[0]

    return None


def _worksheet_to_dataframe(worksheet: gspread.Worksheet) -> pd.DataFrame:
    values = worksheet.get_all_values()
    if not values:
        return pd.DataFrame()

    headers = values[0]
    rows = values[1:] if len(values) > 1 else []

    width = max(len(headers), *(len(r) for r in rows), 1)
    norm_headers = _normalize_headers(headers, width)
    norm_rows = [r + [""] * (width - len(r)) for r in rows]

    df = pd.DataFrame(norm_rows, columns=norm_headers)
    return df.replace("", pd.NA)


def load_sheet_as_dataframe(
    sheet_url: str,
    worksheet_name: str | None = None,
) -> SpreadsheetLoadResult:
    """
    Load a Google Sheet into a pandas DataFrame.
    """
    spreadsheet_id = extract_spreadsheet_id(sheet_url)
    client = _get_gspread_client()

    try:
        spreadsheet = client.open_by_key(spreadsheet_id)
    except gspread.SpreadsheetNotFound as exc:
        raise SheetsServiceError(
            "Google Sheet not found or service account lacks access. "
            "Share the sheet with the service account email."
        ) from exc
    except Exception as exc:
        raise SheetsServiceError(f"Failed to access Google Sheet: {exc}") from exc

    worksheet = None
    try:
        if worksheet_name:
            worksheet = spreadsheet.worksheet(worksheet_name)
        else:
            gid = _worksheet_gid_from_url(sheet_url)
            if gid is not None:
                worksheet = spreadsheet.get_worksheet_by_id(int(gid))
            if worksheet is None:
                worksheet = spreadsheet.sheet1
    except Exception as exc:
        raise SheetsServiceError(f"Worksheet lookup failed: {exc}") from exc

    if worksheet is None:
        raise SheetsServiceError("No worksheet available in Google Sheet")

    df = _worksheet_to_dataframe(worksheet)
    worksheet_names = [ws.title for ws in spreadsheet.worksheets()]

    return SpreadsheetLoadResult(
        dataframe=df,
        source_name=spreadsheet.title,
        worksheet_name=worksheet.title,
        worksheet_names=worksheet_names,
    )


def load_uploaded_spreadsheet(
    file_bytes: bytes,
    filename: str,
    worksheet_name: str | None = None,
) -> SpreadsheetLoadResult:
    """
    Load CSV/XLSX bytes into DataFrame.
    """
    lower = filename.lower()

    if lower.endswith(".csv"):
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), keep_default_na=True)
        except Exception as exc:
            raise SheetsServiceError(f"Failed to read CSV: {exc}") from exc
        return SpreadsheetLoadResult(dataframe=df, source_name=filename)

    if lower.endswith(".xlsx"):
        try:
            excel = pd.ExcelFile(io.BytesIO(file_bytes), engine="openpyxl")
            sheet_names = excel.sheet_names
            if not sheet_names:
                raise SheetsServiceError("Excel file contains no worksheets")

            target_sheet = worksheet_name or sheet_names[0]
            if target_sheet not in sheet_names:
                raise SheetsServiceError(
                    f"Worksheet '{target_sheet}' not found. Available: {', '.join(sheet_names)}"
                )

            df = pd.read_excel(excel, sheet_name=target_sheet, engine="openpyxl")
        except SheetsServiceError:
            raise
        except Exception as exc:
            raise SheetsServiceError(f"Failed to read XLSX: {exc}") from exc

        return SpreadsheetLoadResult(
            dataframe=df,
            source_name=filename,
            worksheet_name=target_sheet,
            worksheet_names=sheet_names,
        )

    raise SheetsServiceError("Unsupported file type. Only .csv and .xlsx are supported")

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"

# Critical: load root .env so GEMINI_API_KEY is available via os.environ
load_dotenv(ROOT / ".env", override=True)
load_dotenv(ROOT / "backend" / ".env", override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ROOT / ".env"), str(ROOT / "backend" / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SwipeNest AI"
    data_dir: Path = DATA
    processed_dir: Path = DATA / "processed"
    images_dir: Path = DATA / "images"
    embeddings_dir: Path = DATA / "embeddings"
    db_path: Path = DATA / "swipenest.db"
    text_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @staticmethod
    def _clean_env(value: str | None) -> str:
        if not value:
            return ""
        v = value.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in {"'", '"'}:
            v = v[1:-1].strip()
        return v

    @property
    def gemini_api_key(self) -> str | None:
        key = self._clean_env(
            os.getenv("GEMINI_API_KEY")
            or os.getenv("SWIPENEST_LLM_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
        )
        return key or None

    @property
    def gemini_model(self) -> str:
        return self._clean_env(os.getenv("GEMINI_MODEL")) or "gemini-2.0-flash"


settings = Settings()

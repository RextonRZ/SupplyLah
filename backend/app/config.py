from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"protected_namespaces": ("settings_",), "env_file": ".env", "env_file_encoding": "utf-8"}

    # Ilmu.ai GLM (kept for reference, currently inactive)
    ilmu_api_key: str = ""
    ilmu_base_url: str = "https://api.ilmu.ai/anthropic"

    # Google Gemini (primary — free tier via AI Studio)
    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"

    # Model IDs
    model_reasoning: str = "gemini-2.0-flash"
    model_fast: str = "gemini-2.0-flash"
    model_vision: str = "gemini-2.0-flash"
    model_asr: str = "gemini-2.0-flash"

    # Supabase
    supabase_url: str = "http://localhost:54321"
    supabase_service_key: str = "mock-key"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = "whatsapp:+14155238886"

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_bucket_name: str = "supplylah-media"
    aws_region: str = "ap-southeast-1"

    # Google Sheets
    google_sheets_id: str = ""
    google_credentials_path: str = "credentials.json"

    # Frontend URL (used for invite redirect)
    frontend_url: str = "http://localhost:3000"

    # App
    default_merchant_id: str = "00000000-0000-0000-0000-000000000001"
    confirmation_timeout_minutes: int = 30
    low_confidence_threshold: float = 0.65

    # Feature flags — flip to False to use real APIs
    use_mock_whatsapp: bool = True
    use_mock_lalamove: bool = True
    use_mock_sheets: bool = True
    
    # Groq
    groq_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()

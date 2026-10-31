import os
from typing import Optional
from pydantic_settings import BaseSettings

DOTENV = os.path.join(os.path.dirname(__file__), ".env")


class Settings(BaseSettings):
    sendgrid_api_key: Optional[str] = None
    database_url: Optional[str] = None
    # Comma-separated list of browser origins allowed to call this API.
    # Read as a plain string rather than a List[str], because
    # pydantic-settings parses a list-typed field as JSON and a bare
    # "http://localhost:5173" in .env then fails to start the app.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ------------------------------------------------------------------
    # Staff login (Supabase Auth).
    #
    # auth_required defaults to TRUE so a deployment that forgets to set it
    # is locked, not open. Only a developer's own .env should ever say false.
    # ------------------------------------------------------------------
    auth_required: bool = True
    # e.g. https://abcd1234.supabase.co - used to fetch the public keys that
    # sign staff login tokens.
    supabase_url: Optional[str] = None
    # Only needed if the Supabase project still signs tokens with the legacy
    # shared secret (HS256). New projects use published keys and leave this blank.
    supabase_jwt_secret: Optional[str] = None
    # Who counts as staff, besides anyone whose email is in the users table.
    # Comma separated. Lets the first person in before the People screen has rows.
    staff_emails: str = ""

    # ------------------------------------------------------------------
    # WooCommerce (the online shop).
    # ------------------------------------------------------------------
    # e.g. https://sapphirewoodcrafts.co.uk - no trailing slash needed.
    wc_url: Optional[str] = None
    # REST API key pair from WooCommerce > Settings > Advanced > REST API,
    # read-only is enough. Used by the catch-up sync.
    wc_consumer_key: Optional[str] = None
    wc_consumer_secret: Optional[str] = None
    # The "Secret" shown on each WooCommerce webhook. All webhooks share one.
    wc_webhook_secret: Optional[str] = None
    # How often the catch-up sync runs, in minutes. 0 turns the timer off
    # (the manual /integrations/woocommerce/resync endpoint still works).
    wc_sync_interval_minutes: int = 15

    # Shared secret for the website's enquiry form (the WordPress plugin signs
    # each submission with it).
    website_enquiry_secret: Optional[str] = None

    class Config:
        env_file = DOTENV

    @property
    def staff_email_set(self) -> set:
        return {e.strip().lower() for e in self.staff_emails.split(",") if e.strip()}

    @property
    def woocommerce_api_ready(self) -> bool:
        return bool(self.wc_url and self.wc_consumer_key and self.wc_consumer_secret)


settings = Settings()

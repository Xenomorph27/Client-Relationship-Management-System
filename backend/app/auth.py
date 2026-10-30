"""
Staff login check for every CRM endpoint.

Staff sign in on the frontend with Supabase Auth, which hands the browser a
signed token (a JWT). The browser sends it as "Authorization: Bearer <token>"
on every request, and this module decides whether to let the request through.

Two separate questions are answered, in order:

  1. Is the token genuine and current?  Checked against Supabase's published
     signing keys (or the legacy shared secret on older projects). A forged,
     expired or wrong-project token is a 401.

  2. Is this person staff?  A valid Supabase login is NOT enough on its own:
     if sign-ups were ever left open, any stranger could create an account and
     read every customer. So the email must also be on the staff list - either
     a row in the users table (managed on the People screen) or the
     STAFF_EMAILS setting (to let the first person in). Otherwise 403.

The check fails CLOSED. If AUTH_REQUIRED is true but Supabase is not
configured, every request is refused rather than quietly allowed.
"""

from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.database import get_db
from models.users import User
from settings import settings

_bearer = HTTPBearer(auto_error=False)
_jwks_client: Optional[jwt.PyJWKClient] = None


def _issuer() -> str:
    return settings.supabase_url.rstrip("/") + "/auth/v1"


def _jwks() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        # Keys are cached, so this is one network call per hour, not per request.
        _jwks_client = jwt.PyJWKClient(
            _issuer() + "/.well-known/jwks.json", cache_keys=True, lifespan=3600
        )
    return _jwks_client


def _unauthorised(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"},
    )


def decode_token(token: str) -> dict:
    """Verify signature, expiry, audience and issuer. Raises 401 on any failure."""
    if not settings.supabase_url:
        raise _unauthorised("Login is not configured on the server (SUPABASE_URL is missing).")
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        options = {"require": ["exp", "sub"]}
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise _unauthorised("This token uses the legacy signing secret, which is not configured.")
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                issuer=_issuer(),
                options=options,
            )
        key = _jwks().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=_issuer(),
            options=options,
        )
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise _unauthorised("Your session has expired. Please sign in again.")
    except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
        raise _unauthorised("Invalid login token.") from exc


def is_staff_email(db: Session, email: Optional[str]) -> bool:
    if not email:
        return False
    email = email.strip().lower()
    if email in settings.staff_email_set:
        return True
    return (
        db.query(User.id).filter(func.lower(User.email) == email).first() is not None
    )


def require_staff(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> dict:
    """FastAPI dependency. Returns {"email", "user_id"} for a signed-in staff member."""
    if not settings.auth_required:
        return {"email": None, "user_id": None, "auth": "disabled"}

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorised("Please sign in.")

    claims = decode_token(credentials.credentials)
    email = claims.get("email")
    if not is_staff_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not on the staff list. Ask an administrator to add you on the People screen.",
        )
    return {"email": email, "user_id": claims.get("sub"), "auth": "supabase"}

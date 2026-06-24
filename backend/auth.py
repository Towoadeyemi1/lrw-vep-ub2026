"""
Authentication middleware for the Invoice Routing API.

All /api/ routes (except /api/health) require either:
  - X-Demo-Password header, OR
  - ?password=xxx query parameter

The password is read from the DEMO_ACCESS_PASSWORD environment variable.
If the env var is not set, auth is disabled (open access) for local dev.
"""

import os
from fastapi import Request, HTTPException, status


DEMO_PASSWORD = os.getenv("DEMO_ACCESS_PASSWORD", "")


def check_auth(request: Request) -> bool:
    """
    Returns True if auth passes.
    Raises HTTPException(401) if auth fails.
    Returns True unconditionally when DEMO_ACCESS_PASSWORD is not set.
    """
    if not DEMO_PASSWORD:
        # No password configured — open access (local dev mode)
        return True

    # Check header first
    header_password = request.headers.get("X-Demo-Password", "")
    if header_password and header_password == DEMO_PASSWORD:
        return True

    # Fall back to query param
    query_password = request.query_params.get("password", "")
    if query_password and query_password == DEMO_PASSWORD:
        return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing demo password. Provide X-Demo-Password header or ?password= query parameter.",
        headers={"WWW-Authenticate": "Demo"},
    )


def require_auth(request: Request) -> bool:
    """FastAPI dependency for protected routes."""
    return check_auth(request)

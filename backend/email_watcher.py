"""
Gmail IMAP watcher for automatic invoice processing.

Monitors invoices.inspirationtechcorp@gmail.com for emails with
invoice attachments. Supported attachment types match the folder
watcher: PDF, DOCX, images, TXT.

Runs as a background thread that polls every POLL_INTERVAL_SECONDS.
Processed emails are marked as seen and moved to a 'Processed' label.

Environment variables:
  GMAIL_EMAIL        — Gmail address to monitor
  GMAIL_APP_PASSWORD — Gmail App Password (not account password)
  EMAIL_POLL_INTERVAL — Seconds between IMAP polls (default: 60)
"""

from __future__ import annotations

import email
import imaplib
import logging
import os
import threading
import time
from datetime import datetime
from email.message import Message
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

GMAIL_EMAIL = os.getenv("GMAIL_EMAIL", "invoices.inspirationtechcorp@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "dcda uclw duty hsir")
IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993
POLL_INTERVAL = int(os.getenv("EMAIL_POLL_INTERVAL", "60"))

SUPPORTED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
}

SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".txt",
    ".jpg", ".jpeg", ".png", ".gif",
    ".webp", ".bmp", ".tiff", ".tif",
}

# Module-level state
_watcher_running: bool = False
_watcher_thread: Optional[threading.Thread] = None
_emails_processed: int = 0
_attachments_processed: int = 0
_last_email_subject: Optional[str] = None
_error_count: int = 0
_start_time: Optional[datetime] = None
_process_callback = None


def get_status() -> dict:
    """Return current email watcher status."""
    return {
        "enabled": _watcher_running,
        "email_account": GMAIL_EMAIL,
        "poll_interval_seconds": POLL_INTERVAL,
        "emails_processed": _emails_processed,
        "attachments_processed": _attachments_processed,
        "error_count": _error_count,
        "last_email_subject": _last_email_subject,
        "uptime_seconds": (
            int((datetime.utcnow() - _start_time).total_seconds())
            if _start_time
            else 0
        ),
        "credentials_configured": bool(GMAIL_EMAIL and GMAIL_APP_PASSWORD),
    }


def _connect_imap() -> imaplib.IMAP4_SSL:
    """Connect and authenticate to Gmail IMAP."""
    mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    mail.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
    return mail


def _get_attachment_filename(part: Message) -> Optional[str]:
    """Extract attachment filename from MIME part."""
    filename = part.get_filename()
    if filename:
        # Decode RFC2047 encoded filenames
        decoded_parts = email.header.decode_header(filename)
        decoded_filename = ""
        for chunk, charset in decoded_parts:
            if isinstance(chunk, bytes):
                decoded_filename += chunk.decode(charset or "utf-8", errors="replace")
            else:
                decoded_filename += chunk
        return decoded_filename
    return None


def _is_supported_attachment(part: Message) -> bool:
    """Return True if this MIME part is a supported invoice file."""
    content_type = part.get_content_type()
    if content_type in SUPPORTED_MIME_TYPES:
        return True

    filename = _get_attachment_filename(part)
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in SUPPORTED_EXTENSIONS:
            return True

    return False


def _process_email(mail: imaplib.IMAP4_SSL, email_id: bytes) -> int:
    """
    Process a single email. Returns number of attachments processed.
    """
    global _last_email_subject

    _, msg_data = mail.fetch(email_id, "(RFC822)")
    if not msg_data or not msg_data[0]:
        return 0

    raw_email = msg_data[0][1]
    msg = email.message_from_bytes(raw_email)

    subject = msg.get("Subject", "(no subject)")
    sender = msg.get("From", "(unknown)")
    _last_email_subject = subject

    logger.info("Email watcher: processing email from %s: %s", sender, subject)

    attachments_found = 0

    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        if part.get("Content-Disposition") is None and part.get_content_type() not in SUPPORTED_MIME_TYPES:
            # Skip non-attachment parts unless they're a supported type
            disp = part.get("Content-Disposition", "")
            if "attachment" not in disp and "inline" not in disp:
                continue

        if not _is_supported_attachment(part):
            continue

        filename = _get_attachment_filename(part) or f"email_attachment_{email_id.decode()}"
        data = part.get_payload(decode=True)

        if not data:
            continue

        content_type = part.get_content_type()
        logger.info(
            "Email watcher: found attachment %s (%s, %d bytes)",
            filename, content_type, len(data)
        )

        if _process_callback:
            try:
                source_metadata = {
                    "email_from": sender,
                    "email_subject": subject,
                    "email_date": msg.get("Date", ""),
                }
                _process_callback(
                    data=data,
                    filename=filename,
                    source="email",
                    source_metadata=source_metadata,
                )
                attachments_found += 1
            except Exception as exc:
                logger.error(
                    "Email watcher: error processing attachment %s: %s",
                    filename, exc
                )

    return attachments_found


def _poll_inbox(mail: imaplib.IMAP4_SSL) -> int:
    """
    Poll inbox for unseen emails with invoice attachments.
    Returns number of emails processed.
    """
    mail.select("INBOX")

    # Search for unseen emails
    _, msg_ids = mail.search(None, "UNSEEN")
    email_ids = msg_ids[0].split() if msg_ids[0] else []

    if not email_ids:
        return 0

    logger.info("Email watcher: found %d unseen emails", len(email_ids))
    emails_handled = 0

    for email_id in email_ids:
        try:
            attachments = _process_email(mail, email_id)
            if attachments > 0:
                # Mark as read
                mail.store(email_id, "+FLAGS", "\\Seen")
                emails_handled += 1
            else:
                # No relevant attachments — still mark as read to avoid re-processing
                mail.store(email_id, "+FLAGS", "\\Seen")
                logger.debug(
                    "Email watcher: email %s had no invoice attachments, marking as read",
                    email_id.decode()
                )
        except Exception as exc:
            logger.error(
                "Email watcher: error processing email %s: %s",
                email_id.decode(), exc
            )

    return emails_handled


def _watcher_loop() -> None:
    """Main watcher loop — runs in background thread."""
    global _emails_processed, _attachments_processed, _error_count

    logger.info(
        "Email watcher thread started for %s (polling every %ds)",
        GMAIL_EMAIL, POLL_INTERVAL
    )

    while _watcher_running:
        mail = None
        try:
            mail = _connect_imap()
            processed = _poll_inbox(mail)
            _emails_processed += processed
        except imaplib.IMAP4.abort as exc:
            logger.warning("IMAP connection aborted: %s", exc)
            _error_count += 1
        except imaplib.IMAP4.error as exc:
            logger.error("IMAP error: %s", exc)
            _error_count += 1
        except OSError as exc:
            logger.error("Network error in email watcher: %s", exc)
            _error_count += 1
        except Exception as exc:
            logger.error("Unexpected error in email watcher: %s", exc)
            _error_count += 1
        finally:
            if mail:
                try:
                    mail.logout()
                except Exception:
                    pass

        # Sleep in small increments so we can respond to stop signals
        for _ in range(POLL_INTERVAL):
            if not _watcher_running:
                break
            time.sleep(1)

    logger.info("Email watcher thread stopped")


def start_watcher(process_callback) -> bool:
    """
    Start the email watcher in a background thread.

    Parameters
    ----------
    process_callback : callable
        Synchronous callable(data: bytes, filename: str, source: str,
        source_metadata: dict).

    Returns
    -------
    bool
        True if started, False if credentials not configured or already running.
    """
    global _watcher_running, _watcher_thread, _start_time, _process_callback

    if _watcher_running:
        logger.info("Email watcher already running")
        return True

    if not GMAIL_EMAIL or not GMAIL_APP_PASSWORD:
        logger.warning(
            "Email watcher: GMAIL_EMAIL or GMAIL_APP_PASSWORD not set — watcher disabled"
        )
        return False

    # Quick connectivity test
    try:
        mail = _connect_imap()
        mail.logout()
        logger.info("Email watcher: IMAP connection test passed")
    except Exception as exc:
        logger.error("Email watcher: IMAP connection test failed: %s", exc)
        return False

    _process_callback = process_callback
    _watcher_running = True
    _start_time = datetime.utcnow()

    thread = threading.Thread(target=_watcher_loop, daemon=True, name="email-watcher")
    thread.start()
    _watcher_thread = thread
    logger.info("Email watcher started for %s", GMAIL_EMAIL)
    return True


def stop_watcher() -> None:
    """Signal the email watcher thread to stop."""
    global _watcher_running, _watcher_thread

    _watcher_running = False
    if _watcher_thread and _watcher_thread.is_alive():
        _watcher_thread.join(timeout=10)
    _watcher_thread = None
    logger.info("Email watcher stopped")

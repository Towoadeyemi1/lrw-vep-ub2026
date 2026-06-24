"""
Folder watcher for automatic invoice processing.

Monitors /var/www/invoice-router/watched/incoming/ for new files.
When a file appears, it is processed through the full classification
pipeline and the result is written to the database.

Uses the watchdog library (inotify on Linux, FSEvents on macOS).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

WATCH_DIR = os.getenv(
    "INVOICE_WATCH_DIR",
    "/var/www/invoice-router/watched/incoming",
)
PROCESSED_DIR = os.getenv(
    "INVOICE_PROCESSED_DIR",
    "/var/www/invoice-router/watched/processed",
)
ERROR_DIR = os.getenv(
    "INVOICE_ERROR_DIR",
    "/var/www/invoice-router/watched/error",
)

SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".doc",
    ".txt", ".jpg", ".jpeg",
    ".png", ".gif", ".webp",
    ".bmp", ".tiff", ".tif",
}

# Module-level state
_watcher_running: bool = False
_watcher_thread: Optional[object] = None
_files_processed: int = 0
_last_file: Optional[str] = None
_start_time: Optional[datetime] = None
_error_count: int = 0


def get_status() -> dict:
    """Return current watcher status for the /api/watch-folder/status endpoint."""
    return {
        "enabled": _watcher_running,
        "watch_directory": WATCH_DIR,
        "processed_directory": PROCESSED_DIR,
        "error_directory": ERROR_DIR,
        "files_processed": _files_processed,
        "error_count": _error_count,
        "last_file": _last_file,
        "uptime_seconds": (
            int((datetime.utcnow() - _start_time).total_seconds())
            if _start_time
            else 0
        ),
        "directory_exists": Path(WATCH_DIR).is_dir(),
        "supported_extensions": sorted(SUPPORTED_EXTENSIONS),
    }


def _ensure_dirs() -> bool:
    """Create watch directories if they don't exist. Returns True on success."""
    try:
        for d in [WATCH_DIR, PROCESSED_DIR, ERROR_DIR]:
            Path(d).mkdir(parents=True, exist_ok=True)
        return True
    except PermissionError as exc:
        logger.warning(
            "Cannot create watch directories (permission denied): %s", exc
        )
        return False
    except Exception as exc:
        logger.warning("Cannot create watch directories: %s", exc)
        return False


class _InvoiceHandler:
    """
    watchdog event handler.  Processes new/moved-in files.

    We hold a reference to the FastAPI app's state so we can reach
    the database session factory and pipeline functions without
    circular imports.
    """

    def __init__(self, process_callback):
        self.process_callback = process_callback

    def dispatch(self, event):
        """Called by watchdog for every filesystem event."""
        from watchdog.events import FileCreatedEvent, FileMovedEvent  # type: ignore

        if isinstance(event, (FileCreatedEvent,)):
            self._handle_new_file(event.src_path)
        elif isinstance(event, FileMovedEvent):
            self._handle_new_file(event.dest_path)

    def _handle_new_file(self, path: str) -> None:
        global _files_processed, _last_file, _error_count

        p = Path(path)

        # Ignore hidden files and unsupported formats
        if p.name.startswith("."):
            return
        if p.suffix.lower() not in SUPPORTED_EXTENSIONS:
            logger.debug("Ignoring unsupported file: %s", p.name)
            return

        logger.info("Folder watcher: detected file %s", p.name)
        _last_file = p.name

        try:
            # Read the file
            with open(p, "rb") as f:
                data = f.read()

            # Invoke the callback (usually an async function wrapped in asyncio.run)
            self.process_callback(data=data, filename=p.name, source="folder_watch")
            _files_processed += 1

            # Move to processed dir
            dest = Path(PROCESSED_DIR) / p.name
            p.rename(dest)
            logger.info("Folder watcher: processed %s → %s", p.name, dest)
        except Exception as exc:
            _error_count += 1
            logger.error("Folder watcher: error processing %s: %s", p.name, exc)
            # Move to error dir
            try:
                dest = Path(ERROR_DIR) / p.name
                p.rename(dest)
            except Exception:
                pass


def start_watcher(process_callback) -> bool:
    """
    Start the folder watcher in a background thread.

    Parameters
    ----------
    process_callback : callable
        Synchronous callable(data: bytes, filename: str, source: str).
        Called for each new file. Should handle its own DB session.

    Returns
    -------
    bool
        True if the watcher started, False if the directory couldn't be created.
    """
    global _watcher_running, _watcher_thread, _start_time

    if _watcher_running:
        logger.info("Folder watcher already running")
        return True

    if not _ensure_dirs():
        logger.warning("Folder watcher: directories not available — watcher disabled")
        return False

    try:
        from watchdog.observers import Observer  # type: ignore
        from watchdog.events import FileSystemEventHandler  # type: ignore
    except ImportError:
        logger.warning("watchdog not installed — folder watcher disabled")
        return False

    handler = _InvoiceHandler(process_callback)
    observer = Observer()
    observer.schedule(handler, WATCH_DIR, recursive=False)

    try:
        observer.start()
        _watcher_running = True
        _watcher_thread = observer
        _start_time = datetime.utcnow()
        logger.info("Folder watcher started on %s", WATCH_DIR)
        return True
    except Exception as exc:
        logger.error("Failed to start folder watcher: %s", exc)
        return False


def stop_watcher() -> None:
    """Stop the folder watcher."""
    global _watcher_running, _watcher_thread

    if _watcher_thread is not None:
        try:
            _watcher_thread.stop()
            _watcher_thread.join(timeout=5)
        except Exception as exc:
            logger.warning("Error stopping folder watcher: %s", exc)
        _watcher_thread = None

    _watcher_running = False
    logger.info("Folder watcher stopped")

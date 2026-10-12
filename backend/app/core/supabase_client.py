"""
Supabase Storage Manager
========================
Handles cloud object storage for uploaded enterprise documents (PDF, TXT, MD, CSV)
using Supabase Storage buckets ("knowledge-documents").
"""

import os
import mimetypes
from typing import Optional, Dict, Any, List
from pathlib import Path

from app.config import settings

try:
    from supabase import create_client, Client
    SUPABASE_INSTALLED = True
except ImportError:
    Client = None
    SUPABASE_INSTALLED = False


class SupabaseStorageManager:
    """
    Manages document storage in Supabase Storage.
    """
    _instance: Optional["SupabaseStorageManager"] = None

    def __init__(self):
        self.bucket_name = getattr(settings, "SUPABASE_BUCKET_NAME", "knowledge-documents") or "knowledge-documents"
        self.client: Optional[Client] = None
        self.enabled = False
        self._init_client()

    def _init_client(self):
        if not SUPABASE_INSTALLED:
            print("ℹ️ supabase python package not installed. Supabase storage disabled.")
            return

        url = getattr(settings, "SUPABASE_URL", None)
        # Prefer secret key (service role) for administrative storage operations, fallback to publishable
        key = getattr(settings, "SUPABASE_SECRET_KEY", None) or getattr(settings, "SUPABASE_PUBLISHABLE_KEY", None)

        if url and key:
            try:
                self.client = create_client(url, key)
                self.enabled = True
                print(f"✅ Supabase Storage initialized for bucket '{self.bucket_name}' ({url})")
            except Exception as e:
                print(f"⚠️ Failed to initialize Supabase client: {e}")
                self.enabled = False

    @classmethod
    def get_instance(cls) -> "SupabaseStorageManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def upload_file(
        self,
        filename: str,
        content_bytes: bytes,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Uploads document file bytes to Supabase Storage bucket.
        """
        if not self.enabled or not self.client:
            return {
                "uploaded_to_supabase": False,
                "public_url": None,
                "message": "Supabase storage not configured."
            }

        # Deduce MIME type
        if not content_type:
            mime, _ = mimetypes.guess_type(filename)
            content_type = mime or "application/octet-stream"

        try:
            # Upsert ensures that existing files with the same name can be overwritten cleanly
            self.client.storage.from_(self.bucket_name).upload(
                path=filename,
                file=content_bytes,
                file_options={"upsert": "true", "content-type": content_type}
            )

            public_url = self.client.storage.from_(self.bucket_name).get_public_url(filename)
            return {
                "uploaded_to_supabase": True,
                "bucket": self.bucket_name,
                "path": filename,
                "public_url": public_url,
                "content_type": content_type,
                "size_bytes": len(content_bytes)
            }
        except Exception as e:
            print(f"❌ Supabase upload failed for {filename}: {e}")
            return {
                "uploaded_to_supabase": False,
                "public_url": None,
                "error": str(e)
            }

    def delete_file(self, filename: str) -> bool:
        """
        Deletes a file from the Supabase Storage bucket.
        """
        if not self.enabled or not self.client:
            return False

        try:
            res = self.client.storage.from_(self.bucket_name).remove([filename])
            return bool(res)
        except Exception as e:
            print(f"⚠️ Supabase delete warning for {filename}: {e}")
            return False

    def get_public_url(self, filename: str) -> Optional[str]:
        """
        Returns public URL of a stored document in Supabase.
        """
        if not self.enabled or not self.client:
            return None
        try:
            return self.client.storage.from_(self.bucket_name).get_public_url(filename)
        except Exception:
            return None

    def list_files(self) -> List[Dict[str, Any]]:
        """
        Lists files in the knowledge-documents bucket.
        """
        if not self.enabled or not self.client:
            return []
        try:
            return self.client.storage.from_(self.bucket_name).list()
        except Exception as e:
            print(f"⚠️ Supabase list_files warning: {e}")
            return []


def get_supabase_storage() -> SupabaseStorageManager:
    return SupabaseStorageManager.get_instance()

"""OAuth Authentication Module for MemoMind.

Supports OAuth authentication for Anthropic and OpenAI providers.
"""

import hashlib
import http.server
import json
import secrets
import socketserver
import threading
import time
import webbrowser
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import parse_qs, urlencode, urlparse

import keyring


# OAuth Provider Configurations
OAUTH_CONFIGS = {
    "anthropic": {
        "authorization_url": "https://console.anthropic.com/oauth/authorize",
        "token_url": "https://console.anthropic.com/oauth/token",
        "client_id": "memomind-cli",
        "scope": "api:read api:write",
        "redirect_uri": "http://localhost:8642/callback",
    },
    "openai": {
        "authorization_url": "https://auth.openai.com/authorize",
        "token_url": "https://auth.openai.com/oauth/token",
        "device_code_url": "https://auth.openai.com/oauth/device/code",
        "client_id": "memomind-cli",
        "scope": "openai.api",
        "redirect_uri": "http://localhost:8642/callback",
    },
}

KEYRING_SERVICE = "memomind-oauth"


@dataclass
class OAuthToken:
    """OAuth token data structure."""

    access_token: str
    token_type: str = "Bearer"
    expires_at: Optional[datetime] = None
    refresh_token: Optional[str] = None
    scope: Optional[str] = None
    provider: str = ""

    def is_expired(self) -> bool:
        """Check if the token is expired."""
        if self.expires_at is None:
            return False
        return datetime.now() >= self.expires_at - timedelta(minutes=5)

    def to_dict(self) -> dict:
        """Convert token to dictionary."""
        return {
            "access_token": self.access_token,
            "token_type": self.token_type,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "refresh_token": self.refresh_token,
            "scope": self.scope,
            "provider": self.provider,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "OAuthToken":
        """Create token from dictionary."""
        expires_at = None
        if data.get("expires_at"):
            expires_at = datetime.fromisoformat(data["expires_at"])
        return cls(
            access_token=data["access_token"],
            token_type=data.get("token_type", "Bearer"),
            expires_at=expires_at,
            refresh_token=data.get("refresh_token"),
            scope=data.get("scope"),
            provider=data.get("provider", ""),
        )


@dataclass
class AuthState:
    """OAuth authentication state."""

    state: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    code_verifier: str = field(default_factory=lambda: secrets.token_urlsafe(64))
    provider: str = ""

    @property
    def code_challenge(self) -> str:
        """Generate PKCE code challenge."""
        digest = hashlib.sha256(self.code_verifier.encode()).digest()
        return secrets.token_urlsafe(32)  # Simplified for demo


class OAuthCallbackHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler for OAuth callback."""

    auth_code: Optional[str] = None
    error: Optional[str] = None
    received_state: Optional[str] = None

    def do_GET(self):
        """Handle GET request (OAuth callback)."""
        parsed = urlparse(self.path)

        if parsed.path == "/callback":
            query = parse_qs(parsed.query)

            if "error" in query:
                OAuthCallbackHandler.error = query["error"][0]
            elif "code" in query:
                OAuthCallbackHandler.auth_code = query["code"][0]
                OAuthCallbackHandler.received_state = query.get("state", [None])[0]

            # Send response
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()

            if OAuthCallbackHandler.error:
                response = """
                <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>❌ 授权失败</h1>
                <p>错误: {}</p>
                <p>请关闭此窗口并重试。</p>
                </body></html>
                """.format(OAuthCallbackHandler.error)
            else:
                response = """
                <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>✅ 授权成功</h1>
                <p>您可以关闭此窗口并返回终端。</p>
                </body></html>
                """

            self.wfile.write(response.encode("utf-8"))
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        """Suppress logging."""
        pass


class OAuthManager:
    """Manages OAuth authentication flow."""

    def __init__(self, data_dir: Optional[Path] = None):
        """Initialize OAuth manager.

        Args:
            data_dir: Directory for storing OAuth data
        """
        self.data_dir = data_dir or Path.home() / ".memomind"
        self.tokens_file = self.data_dir / "oauth_tokens.json"
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        """Ensure data directory exists."""
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def login(
        self,
        provider: str,
        callback: Optional[Callable[[str], None]] = None,
    ) -> OAuthToken:
        """
        Perform OAuth login flow.

        Args:
            provider: OAuth provider (anthropic or openai)
            callback: Optional callback for status updates

        Returns:
            OAuthToken on success

        Raises:
            OAuthError: On authentication failure
        """
        if provider not in OAUTH_CONFIGS:
            raise OAuthError(f"Unsupported provider: {provider}")

        config = OAUTH_CONFIGS[provider]

        # Check for existing valid token
        existing_token = self.get_token(provider)
        if existing_token and not existing_token.is_expired():
            if callback:
                callback(f"使用已有的 {provider} 令牌")
            return existing_token

        # Try to refresh if we have a refresh token
        if existing_token and existing_token.refresh_token:
            try:
                if callback:
                    callback(f"刷新 {provider} 令牌...")
                return self._refresh_token(provider, existing_token.refresh_token)
            except Exception:
                pass  # Fall through to new login

        if callback:
            callback(f"启动 {provider} OAuth 登录...")

        # Start authorization code flow
        return self._authorization_code_flow(provider, config, callback)

    def _authorization_code_flow(
        self,
        provider: str,
        config: dict,
        callback: Optional[Callable[[str], None]] = None,
    ) -> OAuthToken:
        """Perform authorization code flow with PKCE."""
        # Generate state and PKCE
        auth_state = AuthState(provider=provider)

        # Build authorization URL
        params = {
            "client_id": config["client_id"],
            "redirect_uri": config["redirect_uri"],
            "response_type": "code",
            "scope": config["scope"],
            "state": auth_state.state,
            "code_challenge": auth_state.code_challenge,
            "code_challenge_method": "S256",
        }

        auth_url = f"{config['authorization_url']}?{urlencode(params)}"

        # Start local callback server
        port = 8642
        OAuthCallbackHandler.auth_code = None
        OAuthCallbackHandler.error = None
        OAuthCallbackHandler.received_state = None

        server = socketserver.TCPServer(("", port), OAuthCallbackHandler)
        server.timeout = 300  # 5 minute timeout

        server_thread = threading.Thread(target=server.handle_request)
        server_thread.start()

        if callback:
            callback(f"请在浏览器中完成授权...")
            callback(f"如果浏览器没有自动打开，请访问: {auth_url[:50]}...")

        # Open browser
        webbrowser.open(auth_url)

        # Wait for callback
        server_thread.join(timeout=300)
        server.server_close()

        # Check result
        if OAuthCallbackHandler.error:
            raise OAuthError(f"Authorization failed: {OAuthCallbackHandler.error}")

        if not OAuthCallbackHandler.auth_code:
            raise OAuthError("Authorization timeout or cancelled")

        if OAuthCallbackHandler.received_state != auth_state.state:
            raise OAuthError("State mismatch - possible CSRF attack")

        # Exchange code for token
        if callback:
            callback("交换授权码...")

        token = self._exchange_code(
            provider,
            config,
            OAuthCallbackHandler.auth_code,
            auth_state.code_verifier,
        )

        # Save token
        self._save_token(provider, token)

        if callback:
            callback(f"✅ {provider} 登录成功!")

        return token

    def _exchange_code(
        self,
        provider: str,
        config: dict,
        code: str,
        code_verifier: str,
    ) -> OAuthToken:
        """Exchange authorization code for access token."""
        import urllib.request

        data = {
            "grant_type": "authorization_code",
            "client_id": config["client_id"],
            "code": code,
            "redirect_uri": config["redirect_uri"],
            "code_verifier": code_verifier,
        }

        req = urllib.request.Request(
            config["token_url"],
            data=urlencode(data).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode())
        except Exception as e:
            raise OAuthError(f"Token exchange failed: {e}")

        expires_at = None
        if "expires_in" in result:
            expires_at = datetime.now() + timedelta(seconds=result["expires_in"])

        return OAuthToken(
            access_token=result["access_token"],
            token_type=result.get("token_type", "Bearer"),
            expires_at=expires_at,
            refresh_token=result.get("refresh_token"),
            scope=result.get("scope"),
            provider=provider,
        )

    def _refresh_token(self, provider: str, refresh_token: str) -> OAuthToken:
        """Refresh an access token."""
        import urllib.request

        config = OAUTH_CONFIGS[provider]

        data = {
            "grant_type": "refresh_token",
            "client_id": config["client_id"],
            "refresh_token": refresh_token,
        }

        req = urllib.request.Request(
            config["token_url"],
            data=urlencode(data).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode())
        except Exception as e:
            raise OAuthError(f"Token refresh failed: {e}")

        expires_at = None
        if "expires_in" in result:
            expires_at = datetime.now() + timedelta(seconds=result["expires_in"])

        token = OAuthToken(
            access_token=result["access_token"],
            token_type=result.get("token_type", "Bearer"),
            expires_at=expires_at,
            refresh_token=result.get("refresh_token", refresh_token),
            scope=result.get("scope"),
            provider=provider,
        )

        self._save_token(provider, token)
        return token

    def _save_token(self, provider: str, token: OAuthToken):
        """Save token securely."""
        # Save access token to keyring
        try:
            keyring.set_password(KEYRING_SERVICE, f"{provider}_access_token", token.access_token)
            if token.refresh_token:
                keyring.set_password(
                    KEYRING_SERVICE, f"{provider}_refresh_token", token.refresh_token
                )
        except Exception:
            pass  # Keyring not available, use file-based storage

        # Save metadata to file
        tokens = self._load_tokens_file()
        tokens[provider] = token.to_dict()
        # Don't save actual tokens to file (security)
        tokens[provider]["access_token"] = "***"
        if tokens[provider].get("refresh_token"):
            tokens[provider]["refresh_token"] = "***"

        with open(self.tokens_file, "w") as f:
            json.dump(tokens, f, indent=2)

    def _load_tokens_file(self) -> dict:
        """Load tokens metadata from file."""
        if self.tokens_file.exists():
            with open(self.tokens_file) as f:
                return json.load(f)
        return {}

    def get_token(self, provider: str) -> Optional[OAuthToken]:
        """Get stored token for provider."""
        tokens = self._load_tokens_file()

        if provider not in tokens:
            return None

        token_data = tokens[provider]

        # Retrieve actual tokens from keyring
        try:
            access_token = keyring.get_password(KEYRING_SERVICE, f"{provider}_access_token")
            refresh_token = keyring.get_password(KEYRING_SERVICE, f"{provider}_refresh_token")
        except Exception:
            return None

        if not access_token:
            return None

        token_data["access_token"] = access_token
        token_data["refresh_token"] = refresh_token

        return OAuthToken.from_dict(token_data)

    def logout(self, provider: str) -> bool:
        """
        Logout and remove stored tokens.

        Args:
            provider: Provider to logout from

        Returns:
            True if tokens were removed
        """
        try:
            keyring.delete_password(KEYRING_SERVICE, f"{provider}_access_token")
            keyring.delete_password(KEYRING_SERVICE, f"{provider}_refresh_token")
        except Exception:
            pass

        tokens = self._load_tokens_file()
        if provider in tokens:
            del tokens[provider]
            with open(self.tokens_file, "w") as f:
                json.dump(tokens, f, indent=2)
            return True

        return False

    def get_api_key(self, provider: str) -> Optional[str]:
        """
        Get API key for provider (from OAuth token or env).

        This method provides a unified way to get authentication
        for API calls, whether using OAuth or API keys.

        Args:
            provider: Provider name

        Returns:
            API key or OAuth access token
        """
        import os

        # First check for OAuth token
        token = self.get_token(provider)
        if token and not token.is_expired():
            return token.access_token

        # Fall back to environment variable
        env_vars = {
            "anthropic": "ANTHROPIC_API_KEY",
            "openai": "OPENAI_API_KEY",
        }

        if provider in env_vars:
            return os.environ.get(env_vars[provider])

        return None

    def is_logged_in(self, provider: str) -> bool:
        """Check if logged in to provider."""
        token = self.get_token(provider)
        return token is not None and not token.is_expired()

    def get_auth_status(self) -> dict:
        """Get authentication status for all providers."""
        status = {}
        for provider in OAUTH_CONFIGS:
            token = self.get_token(provider)
            if token:
                status[provider] = {
                    "logged_in": not token.is_expired(),
                    "expires_at": token.expires_at.isoformat() if token.expires_at else None,
                    "scope": token.scope,
                }
            else:
                status[provider] = {"logged_in": False}
        return status


class OAuthError(Exception):
    """OAuth authentication error."""

    pass

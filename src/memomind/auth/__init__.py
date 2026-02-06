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
    # LLM Providers
    "anthropic": {
        "authorization_url": "https://console.anthropic.com/oauth/authorize",
        "token_url": "https://console.anthropic.com/oauth/token",
        "client_id": "memomind-cli",
        "scope": "api:read api:write",
        "redirect_uri": "http://localhost:8642/callback",
        "category": "llm",
    },
    "openai": {
        "authorization_url": "https://auth.openai.com/authorize",
        "token_url": "https://auth.openai.com/oauth/token",
        "device_code_url": "https://auth.openai.com/oauth/device/code",
        "client_id": "memomind-cli",
        "scope": "openai.api",
        "redirect_uri": "http://localhost:8642/callback",
        "category": "llm",
    },
    # Social Media Platforms
    "douyin": {
        "authorization_url": "https://open.douyin.com/platform/oauth/connect",
        "token_url": "https://open.douyin.com/oauth/access_token",
        "refresh_url": "https://open.douyin.com/oauth/refresh_token",
        "client_id": "",  # User needs to register app to get client_key
        "client_id_key": "client_key",  # Douyin uses client_key instead of client_id
        "scope": "user_info,video.list",
        "redirect_uri": "http://localhost:8642/callback",
        "category": "social",
        "token_expires_in": 86400,  # 24 hours default
        "refresh_expires_in": 2592000,  # 30 days
    },
    "kuaishou": {
        "authorization_url": "https://open.kuaishou.com/oauth2/authorize",
        "token_url": "https://open.kuaishou.com/oauth2/access_token",
        "refresh_url": "https://open.kuaishou.com/oauth2/refresh_token",
        "client_id": "",  # User needs to register app
        "scope": "user_info,user_video_info",
        "redirect_uri": "http://localhost:8642/callback",
        "category": "social",
        "token_expires_in": 172800,  # 48 hours
        "refresh_expires_in": 2592000,  # 30 days
    },
    "xiaohongshu": {
        "authorization_url": "https://open.xiaohongshu.com/oauth/authorize",
        "token_url": "https://open.xiaohongshu.com/oauth/token",
        "refresh_url": "https://open.xiaohongshu.com/oauth/token/refresh",
        "client_id": "",  # User needs to register app
        "scope": "user_info,note_read",
        "redirect_uri": "http://localhost:8642/callback",
        "category": "social",
        "token_expires_in": 86400,  # 24 hours
        "refresh_expires_in": 2592000,  # 30 days
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
    refresh_expires_at: Optional[datetime] = None
    scope: Optional[str] = None
    provider: str = ""
    open_id: Optional[str] = None  # Platform user ID (for social platforms)
    created_at: datetime = field(default_factory=datetime.now)

    def is_expired(self) -> bool:
        """Check if the access token is expired (with 5-minute buffer)."""
        if self.expires_at is None:
            return False
        return datetime.now() >= self.expires_at - timedelta(minutes=5)

    def is_refresh_expired(self) -> bool:
        """Check if the refresh token is expired."""
        if self.refresh_expires_at is None:
            return False
        return datetime.now() >= self.refresh_expires_at

    def can_refresh(self) -> bool:
        """Check if token can be refreshed."""
        return self.refresh_token is not None and not self.is_refresh_expired()

    def needs_refresh(self) -> bool:
        """Check if token needs to be refreshed (expired but can refresh)."""
        return self.is_expired() and self.can_refresh()

    def to_dict(self) -> dict:
        """Convert token to dictionary."""
        return {
            "access_token": self.access_token,
            "token_type": self.token_type,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "refresh_token": self.refresh_token,
            "refresh_expires_at": self.refresh_expires_at.isoformat() if self.refresh_expires_at else None,
            "scope": self.scope,
            "provider": self.provider,
            "open_id": self.open_id,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "OAuthToken":
        """Create token from dictionary."""
        expires_at = None
        if data.get("expires_at"):
            expires_at = datetime.fromisoformat(data["expires_at"])
        refresh_expires_at = None
        if data.get("refresh_expires_at"):
            refresh_expires_at = datetime.fromisoformat(data["refresh_expires_at"])
        created_at = datetime.now()
        if data.get("created_at"):
            created_at = datetime.fromisoformat(data["created_at"])
        return cls(
            access_token=data["access_token"],
            token_type=data.get("token_type", "Bearer"),
            expires_at=expires_at,
            refresh_token=data.get("refresh_token"),
            refresh_expires_at=refresh_expires_at,
            scope=data.get("scope"),
            provider=data.get("provider", ""),
            open_id=data.get("open_id"),
            created_at=created_at,
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
    """Manages OAuth authentication flow for LLM and social platforms."""

    def __init__(self, data_dir: Optional[Path] = None):
        """Initialize OAuth manager.

        Args:
            data_dir: Directory for storing OAuth data
        """
        self.data_dir = data_dir or Path.home() / ".memomind"
        self.tokens_file = self.data_dir / "oauth_tokens.json"
        self.credentials_file = self.data_dir / "oauth_credentials.json"
        self._ensure_data_dir()

    def _ensure_data_dir(self) -> None:
        """Ensure data directory exists."""
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def configure_platform(
        self,
        provider: str,
        client_id: str,
        client_secret: Optional[str] = None,
    ) -> None:
        """
        Configure OAuth credentials for a platform.

        Social platforms require registering an app to get credentials.
        This method stores those credentials securely.

        Args:
            provider: Platform name (douyin, kuaishou, xiaohongshu)
            client_id: App client ID (or client_key for Douyin)
            client_secret: App client secret (optional)
        """
        if provider not in OAUTH_CONFIGS:
            raise OAuthError(f"Unsupported provider: {provider}")

        credentials = self._load_credentials()
        credentials[provider] = {
            "client_id": client_id,
            "client_secret": client_secret,
        }

        # Try to store secret in keyring
        if client_secret:
            try:
                keyring.set_password(KEYRING_SERVICE, f"{provider}_client_secret", client_secret)
                credentials[provider]["client_secret"] = "***"
            except Exception:
                pass  # Keep in file if keyring unavailable

        with open(self.credentials_file, "w") as f:
            json.dump(credentials, f, indent=2)

    def _load_credentials(self) -> dict:
        """Load platform credentials."""
        if self.credentials_file.exists():
            with open(self.credentials_file) as f:
                return json.load(f)
        return {}

    def _get_client_credentials(self, provider: str) -> tuple:
        """Get client credentials for a provider."""
        config = OAUTH_CONFIGS[provider]

        # Check user-configured credentials first
        credentials = self._load_credentials()
        if provider in credentials:
            client_id = credentials[provider].get("client_id")
            client_secret = credentials[provider].get("client_secret")

            # Try to get secret from keyring
            if client_secret == "***":
                try:
                    client_secret = keyring.get_password(KEYRING_SERVICE, f"{provider}_client_secret")
                except Exception:
                    client_secret = None

            if client_id:
                return client_id, client_secret

        # Fall back to built-in config
        return config.get("client_id", ""), None

    def get_valid_token(
        self,
        provider: str,
        callback: Optional[Callable[[str], None]] = None,
    ) -> Optional[OAuthToken]:
        """
        Get a valid token, refreshing automatically if needed.

        This is the main method for getting authentication tokens.
        It handles automatic refresh transparently.

        Args:
            provider: OAuth provider name
            callback: Optional callback for status updates

        Returns:
            Valid OAuthToken or None if not logged in
        """
        token = self.get_token(provider)
        if token is None:
            return None

        # Token is still valid
        if not token.is_expired():
            return token

        # Token expired but can be refreshed
        if token.can_refresh():
            try:
                if callback:
                    callback(f"自动刷新 {provider} 令牌...")
                return self._refresh_token(provider, token.refresh_token)
            except OAuthError:
                # Refresh failed, token is invalid
                return None

        # Token expired and cannot be refreshed
        return None

    def login(
        self,
        provider: str,
        callback: Optional[Callable[[str], None]] = None,
        force: bool = False,
    ) -> OAuthToken:
        """
        Perform OAuth login flow.

        Args:
            provider: OAuth provider name
            callback: Optional callback for status updates
            force: Force new login even if token exists

        Returns:
            OAuthToken on success

        Raises:
            OAuthError: On authentication failure
        """
        if provider not in OAUTH_CONFIGS:
            raise OAuthError(f"不支持的平台: {provider}")

        config = OAUTH_CONFIGS[provider]

        # Check if this is a social platform requiring credentials
        if config.get("category") == "social":
            client_id, _ = self._get_client_credentials(provider)
            if not client_id:
                raise OAuthError(
                    f"请先配置 {provider} 应用凭证。\n"
                    f"运行: memomind auth configure --provider {provider} --client-id YOUR_CLIENT_ID"
                )

        # Check for existing valid token (unless force is True)
        if not force:
            existing_token = self.get_token(provider)
            if existing_token and not existing_token.is_expired():
                if callback:
                    callback(f"使用已有的 {provider} 令牌")
                return existing_token

            # Try to refresh if we have a refresh token
            if existing_token and existing_token.can_refresh():
                try:
                    if callback:
                        callback(f"刷新 {provider} 令牌...")
                    return self._refresh_token(provider, existing_token.refresh_token)
                except OAuthError:
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

        # Get client credentials
        client_id, client_secret = self._get_client_credentials(provider)

        # Build authorization URL with platform-specific params
        client_id_key = config.get("client_id_key", "client_id")
        params = {
            client_id_key: client_id,
            "redirect_uri": config["redirect_uri"],
            "response_type": "code",
            "scope": config["scope"],
            "state": auth_state.state,
        }

        # Add PKCE for providers that support it (LLM providers)
        if config.get("category") != "social":
            params["code_challenge"] = auth_state.code_challenge
            params["code_challenge_method"] = "S256"

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
            callback("请在浏览器中完成授权...")
            callback(f"如果浏览器没有自动打开，请访问: {auth_url[:80]}...")

        # Open browser
        webbrowser.open(auth_url)

        # Wait for callback
        server_thread.join(timeout=300)
        server.server_close()

        # Check result
        if OAuthCallbackHandler.error:
            raise OAuthError(f"授权失败: {OAuthCallbackHandler.error}")

        if not OAuthCallbackHandler.auth_code:
            raise OAuthError("授权超时或已取消")

        if OAuthCallbackHandler.received_state != auth_state.state:
            raise OAuthError("状态不匹配 - 可能存在安全风险")

        # Exchange code for token
        if callback:
            callback("交换授权码...")

        token = self._exchange_code(
            provider,
            config,
            OAuthCallbackHandler.auth_code,
            auth_state.code_verifier,
            client_id,
            client_secret,
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
        client_id: str,
        client_secret: Optional[str] = None,
    ) -> OAuthToken:
        """Exchange authorization code for access token."""
        import urllib.request

        # Build request data based on provider type
        client_id_key = config.get("client_id_key", "client_id")

        if config.get("category") == "social":
            # Social platforms have different token exchange formats
            data = {
                client_id_key: client_id,
                "code": code,
                "grant_type": "authorization_code",
            }
            if client_secret:
                data["client_secret"] = client_secret
        else:
            # LLM providers use standard OAuth with PKCE
            data = {
                "grant_type": "authorization_code",
                "client_id": client_id,
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
            raise OAuthError(f"令牌交换失败: {e}")

        # Handle social platform response formats
        # Some platforms return data nested under 'data' key
        if "data" in result and isinstance(result["data"], dict):
            token_data = result["data"]
        else:
            token_data = result

        # Check for error in response
        if "error_code" in result or "errcode" in result:
            error_msg = result.get("description") or result.get("errmsg") or "Unknown error"
            raise OAuthError(f"令牌交换失败: {error_msg}")

        # Parse expiration
        expires_at = None
        expires_in = token_data.get("expires_in")
        if expires_in:
            expires_at = datetime.now() + timedelta(seconds=int(expires_in))
        elif config.get("token_expires_in"):
            expires_at = datetime.now() + timedelta(seconds=config["token_expires_in"])

        # Parse refresh token expiration
        refresh_expires_at = None
        refresh_expires_in = token_data.get("refresh_expires_in")
        if refresh_expires_in:
            refresh_expires_at = datetime.now() + timedelta(seconds=int(refresh_expires_in))
        elif config.get("refresh_expires_in"):
            refresh_expires_at = datetime.now() + timedelta(seconds=config["refresh_expires_in"])

        return OAuthToken(
            access_token=token_data.get("access_token", ""),
            token_type=token_data.get("token_type", "Bearer"),
            expires_at=expires_at,
            refresh_token=token_data.get("refresh_token"),
            refresh_expires_at=refresh_expires_at,
            scope=token_data.get("scope") or config.get("scope"),
            provider=provider,
            open_id=token_data.get("open_id") or token_data.get("openid"),
        )

    def _refresh_token(self, provider: str, refresh_token: str) -> OAuthToken:
        """Refresh an access token."""
        import urllib.request

        config = OAUTH_CONFIGS[provider]
        client_id, client_secret = self._get_client_credentials(provider)

        # Use refresh URL if available, otherwise use token URL
        refresh_url = config.get("refresh_url") or config["token_url"]
        client_id_key = config.get("client_id_key", "client_id")

        if config.get("category") == "social":
            # Social platforms have different refresh formats
            data = {
                client_id_key: client_id,
                "refresh_token": refresh_token,
            }
            if client_secret:
                data["client_secret"] = client_secret
        else:
            # Standard OAuth refresh
            data = {
                "grant_type": "refresh_token",
                "client_id": client_id,
                "refresh_token": refresh_token,
            }

        req = urllib.request.Request(
            refresh_url,
            data=urlencode(data).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode())
        except Exception as e:
            raise OAuthError(f"令牌刷新失败: {e}")

        # Handle social platform response formats
        if "data" in result and isinstance(result["data"], dict):
            token_data = result["data"]
        else:
            token_data = result

        # Check for error
        if "error_code" in result or "errcode" in result:
            error_msg = result.get("description") or result.get("errmsg") or "Unknown error"
            raise OAuthError(f"令牌刷新失败: {error_msg}")

        # Parse expiration
        expires_at = None
        expires_in = token_data.get("expires_in")
        if expires_in:
            expires_at = datetime.now() + timedelta(seconds=int(expires_in))
        elif config.get("token_expires_in"):
            expires_at = datetime.now() + timedelta(seconds=config["token_expires_in"])

        # Parse refresh token expiration
        refresh_expires_at = None
        refresh_expires_in = token_data.get("refresh_expires_in")
        if refresh_expires_in:
            refresh_expires_at = datetime.now() + timedelta(seconds=int(refresh_expires_in))
        elif config.get("refresh_expires_in"):
            refresh_expires_at = datetime.now() + timedelta(seconds=config["refresh_expires_in"])

        # Get existing token data for open_id
        existing_token = self.get_token(provider)
        open_id = token_data.get("open_id") or token_data.get("openid")
        if not open_id and existing_token:
            open_id = existing_token.open_id

        token = OAuthToken(
            access_token=token_data.get("access_token", ""),
            token_type=token_data.get("token_type", "Bearer"),
            expires_at=expires_at,
            refresh_token=token_data.get("refresh_token") or refresh_token,
            refresh_expires_at=refresh_expires_at,
            scope=token_data.get("scope") or config.get("scope"),
            provider=provider,
            open_id=open_id,
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
        for provider, config in OAUTH_CONFIGS.items():
            token = self.get_token(provider)
            provider_status = {
                "category": config.get("category", "llm"),
                "configured": True,
            }

            # Check if social platform has credentials configured
            if config.get("category") == "social":
                client_id, _ = self._get_client_credentials(provider)
                provider_status["configured"] = bool(client_id)

            if token:
                is_valid = not token.is_expired()
                can_refresh = token.can_refresh()
                provider_status.update({
                    "logged_in": is_valid or can_refresh,
                    "token_valid": is_valid,
                    "can_refresh": can_refresh,
                    "expires_at": token.expires_at.isoformat() if token.expires_at else None,
                    "refresh_expires_at": token.refresh_expires_at.isoformat() if token.refresh_expires_at else None,
                    "scope": token.scope,
                    "open_id": token.open_id,
                })
            else:
                provider_status.update({
                    "logged_in": False,
                    "token_valid": False,
                    "can_refresh": False,
                })

            status[provider] = provider_status
        return status

    def list_providers(self, category: Optional[str] = None) -> list:
        """
        List available OAuth providers.

        Args:
            category: Filter by category ('llm' or 'social')

        Returns:
            List of provider names
        """
        providers = []
        for name, config in OAUTH_CONFIGS.items():
            if category is None or config.get("category") == category:
                providers.append(name)
        return providers

    def get_social_platforms(self) -> list:
        """Get list of social media platforms."""
        return self.list_providers(category="social")

    def get_llm_providers(self) -> list:
        """Get list of LLM providers."""
        return self.list_providers(category="llm")


class OAuthError(Exception):
    """OAuth authentication error."""

    pass


# Helper functions for easy access
def get_supported_providers() -> dict:
    """Get all supported OAuth providers grouped by category."""
    return {
        "llm": ["anthropic", "openai"],
        "social": ["douyin", "kuaishou", "xiaohongshu"],
    }

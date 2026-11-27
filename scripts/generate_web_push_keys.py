"""Create a private local VAPID key and add its public key to backend/.env."""

import base64
import os
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
SECRETS = BACKEND / ".secrets"
PRIVATE_KEY = SECRETS / "web_push_vapid.pem"
ENV_FILE = BACKEND / ".env"


def main() -> None:
    SECRETS.mkdir(parents=True, exist_ok=True)
    key = ec.generate_private_key(ec.SECP256R1())
    private_bytes = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_bytes = key.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    public_key = base64.urlsafe_b64encode(public_bytes).decode("ascii").rstrip("=")
    PRIVATE_KEY.write_bytes(private_bytes)
    os.chmod(PRIVATE_KEY, 0o600)

    env_values = {
        "WEB_PUSH_VAPID_PUBLIC_KEY": public_key,
        "WEB_PUSH_VAPID_PRIVATE_KEY_PATH": ".secrets/web_push_vapid.pem",
        "WEB_PUSH_VAPID_SUBJECT": "https://github.com/Prolexis/yaku-alert-unt",
    }
    existing_lines = ENV_FILE.read_text(encoding="utf-8").splitlines() if ENV_FILE.exists() else []
    updated_names = set()
    output = []
    for line in existing_lines:
        name = line.split("=", 1)[0].strip() if "=" in line else ""
        if name in env_values:
            if name not in updated_names:
                output.append(f"{name}={env_values[name]}")
                updated_names.add(name)
        else:
            output.append(line)
    for name, value in env_values.items():
        if name not in updated_names:
            output.append(f"{name}={value}")
    ENV_FILE.write_text("\n".join(output).rstrip() + "\n", encoding="utf-8")
    print("Claves Web Push listas en backend/.env; la clave privada quedó en backend/.secrets/.")


if __name__ == "__main__":
    main()

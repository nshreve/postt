#!/bin/sh
set -e

REPO="nshreve/postt"
BIN_NAME="postt"
INSTALL_DIR="/usr/local/bin"

# Detect OS
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$OS" in
  darwin) OS="macos" ;;
  linux)  OS="linux" ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)        ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

ARTIFACT="${BIN_NAME}-${OS}-${ARCH}"
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ARTIFACT}"

echo "Downloading postt for ${OS}-${ARCH}..."
curl -fsSL "$DOWNLOAD_URL" -o "/tmp/${BIN_NAME}"
chmod +x "/tmp/${BIN_NAME}"

if [ -w "$INSTALL_DIR" ]; then
  mv "/tmp/${BIN_NAME}" "${INSTALL_DIR}/${BIN_NAME}"
else
  sudo mv "/tmp/${BIN_NAME}" "${INSTALL_DIR}/${BIN_NAME}"
fi

echo "postt installed! Run 'postt --version' to verify."

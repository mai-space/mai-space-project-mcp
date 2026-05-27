#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────
# MAI Project MCP — Install / Update Script
# ──────────────────────────────────────────────────
# Usage: curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash
# Or:    bash install.sh [--dir <path>] [--version <tag>]
# ──────────────────────────────────────────────────

REPO="mai-space/mai-space-project-mcp"
INSTALL_DIR="${MAI_INSTALL_DIR:-${DIR:-"$HOME/.mai"}}"
BIN_DIR="$INSTALL_DIR/bin"
VERSION="${VERSION:-latest}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step()  { printf "${BLUE}==>${NC} %s\n" "$1"; }
print_ok()    { printf "${GREEN}  ✓${NC} %s\n" "$1"; }
print_warn()  { printf "${YELLOW}  ⚠${NC} %s\n" "$1"; }
print_error() { printf "${RED}  ✗${NC} %s\n" "$1"; }

# ── Parse arguments ──────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --help)
      echo "Usage: install.sh [--dir <path>] [--version <tag>]"
      echo ""
      echo "  --dir <path>      Install directory (default: \$HOME/.mai)"
      echo "  --version <tag>   Git tag or branch to install (default: latest)"
      exit 0
      ;;
    *) print_error "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Preflight checks ─────────────────────────────
print_step "Preflight checks"

if ! command -v node &>/dev/null; then
  print_error "Node.js is required but not found."
  print_error "Install from https://nodejs.org/ (version >= 18)"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
  print_error "Node.js >= 18 required (found $(node -v)). Please upgrade."
  exit 1
fi
print_ok "Node.js $(node -v) detected"

if ! command -v npm &>/dev/null; then
  print_error "npm is required but not found."
  exit 1
fi
print_ok "npm $(npm -v) detected"

# ── Determine install/update ─────────────────────
if [[ -f "$INSTALL_DIR/bin/mai" ]]; then
  MODE="update"
  print_step "Existing installation found at $INSTALL_DIR"
else
  MODE="install"
  print_step "Fresh installation to $INSTALL_DIR"
fi

# ── Create directories ───────────────────────────
mkdir -p "$BIN_DIR" "$INSTALL_DIR/data"

# ── Determine source ─────────────────────────────
if [[ -d "$(dirname "$0")/.." ]] && [[ -f "$(dirname "$0")/../package.json" ]]; then
  # Running from local repo
  SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
  print_ok "Installing from local source: $SRC_DIR"
else
  # Clone from GitHub
  TMP_DIR=$(mktemp -d)
  trap "rm -rf '$TMP_DIR'" EXIT

  if [[ "$VERSION" == "latest" ]]; then
    print_step "Fetching latest release from GitHub..."
    VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": "\(.*\)",/\1/' || echo "main")
    print_ok "Latest version: $VERSION"
  fi

  print_step "Cloning $REPO@$VERSION ..."
  git clone --depth 1 --branch "$VERSION" "https://github.com/$REPO.git" "$TMP_DIR/mai-project-mcp" 2>/dev/null || {
    print_error "Failed to clone repository. Check network or version tag."
    exit 1
  }
  SRC_DIR="$TMP_DIR/mai-project-mcp"
  print_ok "Repository cloned"
fi

# ── Build ─────────────────────────────────────────
print_step "Installing dependencies..."
cd "$SRC_DIR"
npm install --no-audit --no-fund 2>&1 | tail -1
print_ok "Dependencies installed"

print_step "Building packages..."
npm run build 2>&1 | tail -3 || {
  print_error "Build failed. See output above."
  exit 1
}
print_ok "Build complete"

# ── Install binaries ─────────────────────────────
print_step "Installing binaries..."

# Create wrapper script that uses the installed source
cat > "$BIN_DIR/mai" << 'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
MAI_HOME="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
MAI_DB_PATH="${MAI_DB_PATH:-"$MAI_HOME/data/mai.db"}"
exec node "$MAI_HOME/lib/apps/cli/dist/index.js" --db "$MAI_DB_PATH" "$@"
WRAPPER

chmod +x "$BIN_DIR/mai"

# Create server wrapper
cat > "$BIN_DIR/mai-space-serve" << 'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
MAI_HOME="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
MAI_DB_PATH="${MAI_DB_PATH:-"$MAI_HOME/data/mai.db"}"
exec node "$MAI_HOME/lib/apps/server/dist/main.js" --db "$MAI_DB_PATH" "$@"
WRAPPER

chmod +x "$BIN_DIR/mai-space-serve"

# Copy built source to install dir
mkdir -p "$INSTALL_DIR/lib"
cp -r node_modules "$INSTALL_DIR/lib/node_modules" 2>/dev/null || true

# Instead of copying everything, link packages
rsync -a --include='package.json' --include='dist/' --include='dist/**' \
  --exclude='*' packages/ "$INSTALL_DIR/lib/packages/" 2>/dev/null || {
  # Fallback: copy everything
  for pkg in packages/* apps/*; do
    if [[ -d "$pkg/dist" ]]; then
      mkdir -p "$INSTALL_DIR/lib/$pkg"
      cp -r "$pkg/dist" "$INSTALL_DIR/lib/$pkg/dist"
      cp "$pkg/package.json" "$INSTALL_DIR/lib/$pkg/package.json" 2>/dev/null || true
    fi
  done
}

# Copy dashboard dist if it exists
if [[ -d "apps/dashboard/dist" ]]; then
  mkdir -p "$INSTALL_DIR/lib/apps/dashboard"
  cp -r apps/dashboard/dist "$INSTALL_DIR/lib/apps/dashboard/dist"
fi

print_ok "Binaries installed to $BIN_DIR"

# ── Add to PATH ──────────────────────────────────
UPDATE_PATH=false
SHELL_PROFILE=""

if [[ "$SHELL" == *"zsh"* ]]; then
  SHELL_PROFILE="$HOME/.zshrc"
elif [[ "$SHELL" == *"bash"* ]]; then
  if [[ -f "$HOME/.bashrc" ]]; then
    SHELL_PROFILE="$HOME/.bashrc"
  elif [[ -f "$HOME/.bash_profile" ]]; then
    SHELL_PROFILE="$HOME/.bash_profile"
  fi
fi

if [[ -n "$SHELL_PROFILE" ]] && ! grep -q "export PATH=\"\$PATH:$BIN_DIR\"" "$SHELL_PROFILE" 2>/dev/null; then
  {
    echo ""
    echo "# MAI Project MCP"
    echo "export PATH=\"\$PATH:$BIN_DIR\""
    echo "export MAI_DB_PATH=\"\$HOME/.mai/data/mai.db\""
  } >> "$SHELL_PROFILE"
  UPDATE_PATH=true
fi

# ── Summary ──────────────────────────────────────
echo ""
echo " ─────────────────────────────────────────────"
echo "  MAI Project MCP — Install Complete"
echo " ─────────────────────────────────────────────"
echo ""

if [[ "$MODE" == "install" ]]; then
  echo "  Installation: $INSTALL_DIR"
  echo "  Binaries:     $BIN_DIR/mai"
  echo "  Database:     $INSTALL_DIR/data/mai.db"
  echo ""

  if $UPDATE_PATH; then
    echo "  PATH updated in $SHELL_PROFILE"
    echo "  Restart your terminal or run:"
    echo "    source $SHELL_PROFILE"
    echo ""
  fi

  echo "  Quick start:"
  echo "    mai projects create my-project \"My Project\""
  echo "    mai tasks create my-project \"First task\""
  echo "    mai tasks claim my-project --by agent-1"
  echo "    mai serve"
  echo ""
else
  echo "  Updated:      $INSTALL_DIR"
  echo "  Previous data preserved."
  echo ""
fi

echo "  To update in the future, run this script again."
echo "  For help: mai --help"
echo ""

# Clean up temp dir if used
if [[ -n "${TMP_DIR:-}" ]] && [[ -d "$TMP_DIR" ]]; then
  rm -rf "$TMP_DIR"
fi

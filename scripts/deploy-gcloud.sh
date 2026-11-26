#!/usr/bin/env bash
set -euo pipefail

# Folio v4.2 Google Cloud Run Deployment Script
# Unlocks huge RAM (8 GiB - 32 GiB), 4-8 vCPUs, and persistent cloud uptime.

SERVICE_NAME="${SERVICE_NAME:-folio}"
REGION="${REGION:-us-central1}"
MEMORY="${MEMORY:-8Gi}"
CPU="${CPU:-4}"
PORT="${PORT:-3000}"
PROJECT_ID="${PROJECT_ID:-}"
API_KEY="${GEMINI_API_KEY:-}"

# Parse optional command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project|-p)
      PROJECT_ID="$2"
      shift 2
      ;;
    --region|-r)
      REGION="$2"
      shift 2
      ;;
    --memory|-m)
      MEMORY="$2"
      shift 2
      ;;
    --cpu|-c)
      CPU="$2"
      shift 2
      ;;
    --service|-s)
      SERVICE_NAME="$2"
      shift 2
      ;;
    --api-key|-k)
      API_KEY="$2"
      shift 2
      ;;
    --help|-h)
      echo "Folio Google Cloud Run Deployer"
      echo ""
      echo "Usage:"
      echo "  ./scripts/deploy-gcloud.sh [options]"
      echo ""
      echo "Options:"
      echo "  --project, -p <id>       Google Cloud Project ID (defaults to active gcloud config)"
      echo "  --memory,  -m <ram>      Container RAM allocation: 8Gi, 16Gi, or 32Gi (default: 8Gi)"
      echo "  --cpu,     -c <cpus>     CPU cores: 2, 4, or 8 (default: 4)"
      echo "  --region,  -r <region>   Cloud Run region (default: us-central1)"
      echo "  --service, -s <name>     Service name (default: folio)"
      echo "  --api-key, -k <key>      Gemini API key to inject into container environment"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1 (run with --help for options)"
      exit 1
      ;;
  esac
done

echo "=================================================="
echo "  Folio Studio -> Google Cloud Run Deployment"
echo "=================================================="

# Check for gcloud CLI
if ! command -v gcloud >/dev/null 2>&1; then
  echo "Error: Google Cloud SDK (gcloud) is not installed on this machine."
  echo "Install it from: https://cloud.google.com/sdk/docs/install"
  echo ""
  echo "Alternatively, deploy directly from Google Cloud Shell where gcloud is pre-installed:"
  echo "  1. Clone or upload this repository to Cloud Shell: https://shell.cloud.google.com"
  echo "  2. Run: ./scripts/deploy-gcloud.sh"
  exit 1
fi

# Detect or prompt for Project ID
if [[ -z "$PROJECT_ID" ]]; then
  DETECTED_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
  if [[ -n "$DETECTED_PROJECT" && "$DETECTED_PROJECT" != "(unset)" ]]; then
    PROJECT_ID="$DETECTED_PROJECT"
    echo "Using active Google Cloud Project: $PROJECT_ID"
  else
    echo "No active project set in gcloud config."
    read -rp "Enter your Google Cloud Project ID: " PROJECT_ID
    if [[ -z "$PROJECT_ID" ]]; then
      echo "Error: Project ID is required."
      exit 1
    fi
    gcloud config set project "$PROJECT_ID"
  fi
else
  gcloud config set project "$PROJECT_ID"
fi

# Look for Gemini API Key in .env if not supplied
if [[ -z "$API_KEY" && -f .env ]]; then
  API_KEY="$(grep -E '^GEMINI_API_KEY=' .env | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
fi

ENV_VARS_FLAG=()
if [[ -n "$API_KEY" ]]; then
  ENV_VARS_FLAG=(--set-env-vars "GEMINI_API_KEY=${API_KEY},NODE_ENV=production,PORT=${PORT}")
else
  ENV_VARS_FLAG=(--set-env-vars "NODE_ENV=production,PORT=${PORT}")
fi

echo "Configuring Cloud Run deployment:"
echo "  - Project:  $PROJECT_ID"
echo "  - Service:  $SERVICE_NAME"
echo "  - Region:   $REGION"
echo "  - RAM:      $MEMORY"
echo "  - CPU:      $CPU"
echo "  - Port:     $PORT"
echo "  - API Key:  $(if [[ -n "$API_KEY" ]]; then echo "Configured (injected)"; else echo "None (will read from secrets or environment)"; fi)"
echo ""

echo "Deploying source to Google Cloud Run (this builds the container image and deploys)..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --memory "$MEMORY" \
  --cpu "$CPU" \
  --port "$PORT" \
  --allow-unauthenticated \
  "${ENV_VARS_FLAG[@]}"

echo ""
echo "=================================================="
echo "Deployment successful! Your Folio instance is running with $MEMORY RAM on Cloud Run."
echo "=================================================="

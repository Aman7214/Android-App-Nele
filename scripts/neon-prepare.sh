#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Expo resolves SDK-compatible versions for its native modules.
npx expo install @neon/auth @neon/functions pg @types/pg jose zod expo-secure-store

curl -fsSL https://neon.com/docs/llms.txt -o /tmp/android-app-neon-llms.txt
curl -fsSL https://neon.com/docs/auth/quick-start/react.md -o /tmp/android-app-neon-auth-react.md
curl -fsSL https://neon.com/docs/compute/functions/authentication.md -o /tmp/android-app-neon-function-auth.md

printf 'Neon SDK installation and documentation download finished.\n'

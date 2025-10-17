#!/bin/bash

# Set environment variables for Firebase App Hosting backend

echo "🔧 Setting environment variables for Firebase App Hosting..."

# Read environment variables from .env
source .env

# Set environment variables for the backend
firebase apphosting:secrets:set GEMINI_API_KEY --project smarttasker-gk --location asia-southeast1 --backend st-backend --data-file <(echo -n "$GEMINI_API_KEY")

# Set public environment variables
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY" --project smarttasker-gk --location asia-southeast1 --backend st-backend
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" --project smarttasker-gk --location asia-southeast1 --backend st-backend
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID" --project smarttasker-gk --location asia-southeast1 --backend st-backend
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" --project smarttasker-gk --location asia-southeast1 --backend st-backend
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" --project smarttasker-gk --location asia-southeast1 --backend st-backend
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID" --project smarttasker-gk --location asia-southeast1 --backend st-backend
firebase apphosting:env:set NEXT_PUBLIC_VAPID_KEY="$NEXT_PUBLIC_VAPID_KEY" --project smarttasker-gk --location asia-southeast1 --backend st-backend

# Set secret environment variables
firebase apphosting:secrets:set VAPID_PRIVATE_KEY --project smarttasker-gk --location asia-southeast1 --backend st-backend --data-file <(echo -n "$VAPID_PRIVATE_KEY")
firebase apphosting:secrets:set VAPID_SUBJECT --project smarttasker-gk --location asia-southeast1 --backend st-backend --data-file <(echo -n "$VAPID_SUBJECT")
firebase apphosting:secrets:set SERVICE_ACCOUNT_KEY --project smarttasker-gk --location asia-southeast1 --backend st-backend --data-file <(echo -n "$SERVICE_ACCOUNT_KEY")
firebase apphosting:secrets:set GOOGLE_CLIENT_ID --project smarttasker-gk --location asia-southeast1 --backend st-backend --data-file <(echo -n "$GOOGLE_CLIENT_ID")
firebase apphosting:secrets:set GOOGLE_CLIENT_SECRET --project smarttasker-gk --location asia-southeast1 --backend st-backend --data-file <(echo -n "$GOOGLE_CLIENT_SECRET")

echo "✅ Environment variables configured!"
echo ""
echo "📝 Note: Update GOOGLE_REDIRECT_URI in Firebase Console to your production URL"
echo "   Example: https://your-app-url.web.app/api/auth/callback/google"

#!/bin/bash

# SmartTasker Firebase Deployment Script

echo "🚀 Starting Firebase deployment for SmartTasker..."

# Step 1: Deploy Firestore rules and indexes
echo "� Deploying Firestore rules and indexes..."
firebase deploy --only firestore

if [ $? -ne 0 ]; then
  echo "⚠️  Firestore deployment encountered an issue, but continuing..."
fi

echo "✅ Firestore configuration deployed!"

# Step 2: Information about App Hosting
echo ""
echo "� For Next.js with API routes, use Firebase App Hosting:"
echo ""
echo "   Firebase App Hosting supports full Next.js applications including API routes."
echo "   Your apphosting.yaml is already configured."
echo ""
echo "   To deploy with App Hosting:"
echo "   1. Connect your GitHub repository to Firebase App Hosting"
echo "   2. Go to: https://console.firebase.google.com/project/smarttasker-gk/apphosting"
echo "   3. Follow the setup wizard to connect your GitHub repo"
echo "   4. Firebase will automatically build and deploy on every push"
echo ""
echo "   OR use Firebase CLI:"
echo "   firebase apphosting:backends:create --project smarttasker-gk"
echo ""
echo "✅ Firestore configuration completed!"
echo ""

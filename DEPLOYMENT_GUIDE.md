# BudgetTracker Production Deployment Guide

## Overview
This guide walks you through deploying your BudgetTracker server and PostgreSQL database for production use with your Play Store app.

## Option 1: Render (Recommended - Free Tier Available)

### Prerequisites
- GitHub account (your code should be pushed to GitHub)
- Render account (https://render.com - sign up free)
- All environment variables ready

### Step 1: Create PostgreSQL Database on Render

1. **Go to Render Dashboard** → https://dashboard.render.com
2. Click **"New +"** → Select **"PostgreSQL"**
3. Configure database:
   - **Name**: `budgettracker-db`
   - **Database**: `budgettracker`
   - **User**: `budgettracker_user`
   - **Region**: Choose closest to your users (e.g., Oregon USA, Frankfurt EU)
   - **Plan**: Free (shared, 90 days retention) or Starter ($7/month)
4. Click **"Create Database"**
5. **SAVE THE CREDENTIALS** - You'll see:
   - **Internal Database URL** (for your server on Render)
   - **External Database URL** (for local development)

### Step 2: Create Web Service on Render

1. In Render Dashboard, click **"New +"** → Select **"Web Service"**
2. **Connect Your Repository**:
   - Connect your GitHub account
   - Select your `budgee-react-native` repository
3. **Configure Service**:
   - **Name**: `budgettracker-api`
   - **Region**: Same as your database
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci && npm run build && npx prisma migrate deploy`
   - **Start Command**: `npm start`
   - **Plan**: Free or Starter

4. **Add Environment Variables**:
   Click "Advanced" → Add these environment variables:

   ```
   DATABASE_URL=<Internal Database URL from Step 1>
   PORT=3000
   NODE_ENV=production
   TRUST_PROXY=1
   JWT_SECRET_KEY=<your-secure-jwt-secret-min-32-chars>
   
   # Cloudinary (for profile pictures)
   CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
   CLOUDINARY_API_KEY=<your-cloudinary-api-key>
   CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>
   
   # Email (for password reset)
   EMAIL_HOST=<your-smtp-host>
   EMAIL_PORT=<your-smtp-port>
   EMAIL_USER=<your-email>
   EMAIL_PASS=<your-email-password>
   
   # Arcjet (security)
   ARCJET_ENV=production
   ARCJET_KEY=<your-arcjet-key>
   ARCJET_MODE=LIVE
   
   # CORS
   ALLOWED_ORIGINS=*
   ```

5. Click **"Create Web Service"**

6. **Get Your API URL**: After deployment, you'll get a URL like:
   ```
   https://budgettracker-api.onrender.com
   ```

### Step 3: Update Your React Native App

Update your client environment variables:

**File**: `client/.env` (create if doesn't exist)
```env
EXPO_PUBLIC_API_BASE_URL=https://budgettracker-api.onrender.com/api
```

Build your app with the production API URL:
```bash
cd client
npx expo prebuild
eas build --platform android --profile production
```

### Step 4: Test Your Deployment

1. **Test API Health**:
   ```
   curl https://budgettracker-api.onrender.com/api/health
   ```

2. **Check Database Connection**:
   - View Render logs in dashboard
   - Look for Prisma connection success

3. **Test Authentication**:
   - Use Postman or your app to register/login
   - Verify database records in Render's database dashboard

---

## Option 2: Railway (Alternative)

### Quick Setup

1. Go to https://railway.app and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Railway auto-detects Node.js and creates PostgreSQL
5. Set environment variables (same as above)
6. Railway provides automatic DATABASE_URL

**Pros**: Simpler setup, generous free tier
**Cons**: Free tier has $5/month credit limit

---

## Option 3: Fly.io (Advanced)

Best for more control and scaling. Requires Docker knowledge.

---

## Important Security Notes

### 1. Generate Secure JWT Secret
```bash
# Generate a secure random string (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. CORS Configuration
For production, update `ALLOWED_ORIGINS` to your app's domain:
```
ALLOWED_ORIGINS=https://yourdomain.com,exp://your-expo-url
```

### 3. Database Backups
- Render Free: 90-day retention, no automatic backups
- Render Paid: Automatic daily backups
- **IMPORTANT**: Set up your own backup strategy for production

### 4. Environment Variables Security
- Never commit `.env` files to Git
- Use Render's environment variable dashboard
- Rotate secrets regularly

---

## Monitoring & Maintenance

### Render Dashboard Features:
1. **Logs**: View real-time application logs
2. **Metrics**: CPU, Memory, Request stats
3. **Shell Access**: Run commands on your server
4. **Manual Deploys**: Redeploy on-demand

### Common Issues:

#### Build fails with TypeScript errors about missing types
**Error**: `Could not find a declaration file for module 'express'` or similar
**Solution**: 
- This project moves TypeScript and type definitions to `dependencies` (not `devDependencies`)
- This ensures they're installed in production builds where `NODE_ENV=production`
- Build command: `npm ci && npm run build && npx prisma migrate deploy`
- The TypeScript compiler and `@types/*` packages are needed at build time, so they're production dependencies
- If you see this error, the dependencies may need reinstalling - trigger a manual deploy

#### Server not starting
- Check logs for errors
- Verify DATABASE_URL is correct
- Ensure Prisma migrations ran successfully
- Confirm all required environment variables are set

#### Database connection issues
- Use **Internal Database URL** (not External) on Render
- Check database is in same region as web service
- Verify `TRUST_PROXY=1` is set
- Internal URL format: `postgresql://user:pass@internal-host/db` (contains "internal")

#### Slow first request (Free tier)
- Render free tier spins down after 15 min inactivity
- First request after inactivity takes 30-60 seconds
- Consider Starter plan ($7/month) for always-on

---

## Scaling for Production

When your app grows:

1. **Upgrade Database**: Free → Starter ($7/mo) for better performance
2. **Upgrade Web Service**: Free → Starter ($7/mo) for always-on
3. **Add Redis**: For session management and caching
4. **CDN**: For static assets and images
5. **Monitoring**: Add Sentry or LogRocket for error tracking

---

## Play Store Preparation

### Update app.json with production URL:
```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://budgettracker-api.onrender.com/api"
    }
  }
}
```

### Build for Production:
```bash
cd client
eas build --platform android --profile production
eas submit -p android
```

---

## Cost Estimate

### Free Tier (Good for Testing):
- Render PostgreSQL: Free (90 days, then data deleted)
- Render Web Service: Free (spins down after 15 min)
- **Total**: $0/month

### Production Ready:
- Render PostgreSQL Starter: $7/month
- Render Web Service Starter: $7/month
- **Total**: $14/month

### Alternative (Railway):
- Everything included: ~$5-10/month depending on usage

---

## Quick Start Commands

```bash
# 1. Push code to GitHub
git add .
git commit -m "Prepare for deployment"
git push origin main

# 2. Deploy on Render (via dashboard)
# 3. Update client environment
echo "EXPO_PUBLIC_API_BASE_URL=https://your-render-url.onrender.com/api" > client/.env

# 4. Test production API
curl https://your-render-url.onrender.com/api/health

# 5. Build app for Play Store
cd client
eas build --platform android --profile production
```

---

## Next Steps

1. ✅ Deploy database on Render
2. ✅ Deploy server on Render
3. ✅ Update client with production API URL
4. ✅ Test all endpoints
5. ✅ Build production APK/AAB
6. ✅ Submit to Google Play Store
7. ✅ Monitor logs and performance

---

## Support Resources

- Render Docs: https://render.com/docs
- Prisma Deployment: https://www.prisma.io/docs/guides/deployment
- Expo Build: https://docs.expo.dev/build/introduction/
- Play Store Publish: https://support.google.com/googleplay/android-developer/answer/9859152

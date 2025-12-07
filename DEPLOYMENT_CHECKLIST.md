# 🚀 Pre-Deployment Checklist

Complete this checklist before deploying to production.

## ✅ Code Preparation

- [ ] All code committed and pushed to GitHub
- [ ] `.env` files are in `.gitignore` (never commit secrets!)
- [ ] Updated `server/.env.example` with all required variables
- [ ] Tested locally with production-like environment
- [ ] All TypeScript errors resolved
- [ ] Database migrations are up-to-date

## ✅ Third-Party Services Setup

### 1. Cloudinary (Image Upload)
- [ ] Create account at https://cloudinary.com
- [ ] Get Cloud Name, API Key, API Secret
- [ ] Test image upload locally

### 2. Email Service (Password Reset)
- [ ] Set up Gmail App Password OR
- [ ] Set up SendGrid/Mailgun account
- [ ] Test email sending locally
- [ ] Update EMAIL_* environment variables

### 3. Arcjet (Security - Optional)
- [ ] Create account at https://arcjet.com
- [ ] Get API key
- [ ] Configure rate limiting rules
- [ ] Update ARCJET_* environment variables

### 4. GitHub Repository
- [ ] Code pushed to main branch
- [ ] Repository is public or Render has access
- [ ] `.gitignore` properly configured

## ✅ Render Deployment

### Step 1: PostgreSQL Database
- [ ] Created PostgreSQL database on Render
- [ ] Saved Internal Database URL
- [ ] Saved External Database URL (for local testing)
- [ ] Database region selected

### Step 2: Web Service
- [ ] Created Web Service on Render
- [ ] Connected to GitHub repository
- [ ] Set `server` as root directory
- [ ] Build command: `npm ci && npm run build && npx prisma migrate deploy`
- [ ] Start command: `npm start`
- [ ] Added all environment variables:
  - [ ] DATABASE_URL (Internal URL from database)
  - [ ] JWT_SECRET_KEY (generate new secure key)
  - [ ] CLOUDINARY_CLOUD_NAME
  - [ ] CLOUDINARY_API_KEY
  - [ ] CLOUDINARY_API_SECRET
  - [ ] EMAIL_HOST
  - [ ] EMAIL_PORT
  - [ ] EMAIL_USER
  - [ ] EMAIL_PASS
  - [ ] ARCJET_ENV=production
  - [ ] ARCJET_KEY
  - [ ] ARCJET_MODE=LIVE
  - [ ] NODE_ENV=production
  - [ ] TRUST_PROXY=1
  - [ ] ALLOWED_ORIGINS=*
- [ ] Deployment successful (check logs)
- [ ] Copied production API URL

## ✅ Testing Production API

- [ ] Test health endpoint: `curl https://your-api.onrender.com/api/health`
- [ ] Test user registration
- [ ] Test user login
- [ ] Test creating budget
- [ ] Test creating transaction
- [ ] Test password reset email
- [ ] Test image upload (profile picture)
- [ ] Check database records in Render dashboard
- [ ] Review logs for errors

## ✅ React Native App Update

- [ ] Updated `client/.env` with production API URL
- [ ] Tested app with production API locally
- [ ] Updated `app.json` version number
- [ ] Created EAS build configuration
- [ ] Built APK/AAB for Android:
  ```bash
  cd client
  eas build --platform android --profile production
  ```
- [ ] Tested production build on device
- [ ] All features working with production API

## ✅ Google Play Store

- [ ] Google Play Developer account created ($25 one-time fee)
- [ ] App screenshots prepared (see SCREENSHOTS_GUIDELINES.md)
- [ ] App description written
- [ ] Privacy policy created and hosted
- [ ] App icon finalized
- [ ] Signed AAB uploaded
- [ ] Store listing completed
- [ ] Content rating questionnaire completed
- [ ] App submitted for review

## ✅ Post-Deployment

- [ ] Monitor Render logs for errors
- [ ] Set up uptime monitoring (e.g., UptimeRobot)
- [ ] Document API endpoints
- [ ] Create backup strategy for database
- [ ] Plan for scaling (if needed)
- [ ] Set up error tracking (e.g., Sentry)

## 🔧 Generate Secure Keys

### JWT Secret (32+ characters)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Test Commands
```bash
# Health check
curl https://your-api.onrender.com/api/health

# Register user
curl -X POST https://your-api.onrender.com/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","username":"testuser"}'

# Login
curl -X POST https://your-api.onrender.com/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

## 📊 Cost Summary

### Free Tier (Good for initial launch)
- Render PostgreSQL Free: $0 (90 days then data deleted)
- Render Web Service Free: $0 (spins down after 15min inactivity)
- **Total: $0/month**

### Production Tier (Recommended for published app)
- Render PostgreSQL Starter: $7/month
- Render Web Service Starter: $7/month
- **Total: $14/month**

## 🆘 Troubleshooting

### "Build failed - TypeScript cannot find types"
- **Error**: `Could not find a declaration file for module 'express'`
- **Fix**: TypeScript and `@types/*` packages are in `dependencies` (not `devDependencies`)
- **Why**: When `NODE_ENV=production`, npm skips devDependencies, but we need types for build
- **Solution**: The package.json is already configured correctly - just redeploy
- If issue persists, clear build cache in Render Dashboard and redeploy

### "Cannot connect to database"
- Verify DATABASE_URL uses **Internal** URL (not External)
- Check database and web service are in same region
- Ensure `TRUST_PROXY=1` is set

### "Migrations failed"
- Check Prisma schema is valid
- Ensure migrations exist in `prisma/migrations/`
- Run `npx prisma migrate dev` locally first

### "Server won't start"
- Check all environment variables are set
- Review Render logs for errors
- Verify Node version compatibility
- Make sure build completed successfully

### "First request very slow"
- Free tier spins down after 15min inactivity
- First request takes 30-60 seconds to wake up
- Upgrade to Starter plan for always-on

## 📚 Useful Links

- [Render Dashboard](https://dashboard.render.com)
- [Render Docs](https://render.com/docs)
- [Prisma Deploy Docs](https://www.prisma.io/docs/guides/deployment)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Play Console](https://play.google.com/console)
- [Cloudinary Dashboard](https://cloudinary.com/console)

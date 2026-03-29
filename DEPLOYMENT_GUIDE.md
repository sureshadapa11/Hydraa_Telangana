## HYDRAA Global Deployment Guide (Railway)

This guide explains how to deploy your HYDRAA application globally using Railway.

### Prerequisites
1. GitHub account (free)
2. Railway account (free - railway.app)
3. Your project files ready

---

## Step 1: Initialize Git Repository

```powershell
cd c:\Users\adapa\Downloads\HydraaHyderabad
git init
git config --global user.email "youremail@example.com"
git config --global user.name "Your Name"
git add .
git commit -m "Initial HYDRAA deployment"
```

---

## Step 2: Push to GitHub

1. Go to https://github.com/new and create a new repository named `hydraa-project`
2. Do NOT add .gitignore, README, or license (we'll use ours)
3. Copy the repository URL

```powershell
git remote add origin https://github.com/YOUR_USERNAME/hydraa-project.git
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy to Railway

### Option A: Using Railway CLI (Recommended)
```powershell
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Create new project
railway init

# 4. Link this to your current directory
railway link

# 5. Add environment variables
railway variables

# 6. Deploy
railway up
```

### Option B: Using Railway Web Dashboard
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "Create New Project" → "Deploy from GitHub repo"
4. Select your `hydraa-project` repository
5. Railway auto-detects Node.js and deploys

---

## Step 4: Configure Environment Variables in Railway

You need to set these environment variables in Railway dashboard:

```
PORT=5000
DB_HOST=your_railway_mysql_host
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hydraa
JWT_SECRET=your-secret-key-here
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
NODE_ENV=production
```

### Get Railway MySQL Details:
1. In Railway dashboard, add MySQL plugin → Click "Add" → "MySQL"
2. Click on MySQL service → Variables tab
3. Copy the connection details

---

## Step 5: Update Your .env File

```env
PORT=5000
DB_HOST=<Railway MySQL Host>
DB_USER=<Railway MySQL User>
DB_PASSWORD=<Railway MySQL Password>
DB_NAME=hydraa
JWT_SECRET=hydraa-secret-2026
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=HYDRAA Team
NODE_ENV=production
```

---

## Step 6: Your Global URLs

Once deployed, you'll get:
- **Main App**: `https://hydraa-project.railway.app`
- **API Base**: `https://hydraa-project.railway.app/api`
- **Home Page**: `https://hydraa-project.railway.app/hydraa-index.html`

---

## Testing the Deployment

### Test Health Check:
```
GET https://hydraa-project.railway.app/api/health
```

### Test Home Page:
```
https://hydraa-project.railway.app/hydraa-index.html
```

### Test API:
```
GET https://hydraa-project.railway.app/api/complaints/track/HYD2603041
```

---

## Access It Globally

Once deployed on Railway:

✅ **From Desktop**: Open browser → `https://hydraa-project.railway.app`
✅ **From Mobile**: Same URL works on any smartphone
✅ **From Any Country**: Works globally instantly
✅ **Share Link**: Give URL to others to access

---

## Troubleshooting

### Error: "Cannot find module"
```
Solution: npm install in Railway logs, check package.json
```

### Error: "Database connection refused"
```
Solution: Update DB_HOST and credentials in Railway variables
```

### Error: "Static files not found"
```
Solution: Ensure all .html files are in root directory
```

### Static Files 404
Update server.js:
```javascript
app.use(express.static(__dirname));
```

---

## Domain Setup (Optional)

To use your own domain instead of railway.app:
1. In Railway → Settings → Domain
2. Add custom domain
3. Update DNS records at your registrar
4. Point to Railway app

---

## Cost

- **Railway Free Tier**: Up to 5GB storage, limited bandwidth
- **Paid Plans**: Start at $5/month
- **After Free Trial**: Auto-scales based on usage

---

## Update & Redeploy

```powershell
# Make changes locally
git add .
git commit -m "Update message"
git push origin main

# Railway auto-deploys within seconds!
```

---

## Support

- Railway Docs: https://docs.railway.app
- HYDRAA API: http://localhost:5000/api/health (when running locally)

---

**Your app is now accessible globally from any device! 🚀**

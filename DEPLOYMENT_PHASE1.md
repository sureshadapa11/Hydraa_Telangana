# Step-by-Step Deployment: HYDRAA to Railway

## Phase 1: Push Code to GitHub (Your Repo: Hydraa_Telangana)

### Step 1.1: Open PowerShell in Your Project Folder
```powershell
cd c:\Users\adapa\Downloads\HydraaHyderabad
```

### Step 1.2: Initialize Git (if not already done)
```powershell
git init
git config user.email "your-email@gmail.com"
git config user.name "Your Name"
```

### Step 1.3: Check Remote URL
```powershell
git remote -v
```
If nothing shows, add remote pointing to YOUR repo:
```powershell
git remote add origin https://github.com/YOUR_USERNAME/Hydraa_Telangana.git
```

If it shows wrong URL, remove and add correct one:
```powershell
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/Hydraa_Telangana.git
```

### Step 1.4: Add All Files to Git
```powershell
git add .
```

### Step 1.5: Check What's Being Added
```powershell
git status
```
You should see:
- hydraa-index.html
- hydraa-login.html
- server.js
- package.json
- controllers/
- routes/
- middleware/
- utils/
- .env
- .gitignore

### Step 1.6: Commit Your Code
```powershell
git commit -m "HYDRAA: Initial deployment to Railway"
```

### Step 1.7: Set Branch to Main
```powershell
git branch -M main
```

### Step 1.8: Push to GitHub (First Time)
```powershell
git push -u origin main
```

**You'll be prompted for authentication:**
- Option 1: GitHub username/password
- Option 2: Personal Access Token (better)

For PAT method:
1. Go to https://github.com/settings/tokens
2. Click "Generate new token"
3. Select: repo, workflow
4. Copy token
5. When prompted for password, paste the token

---

## Expected Output
```
Enumerating objects: 25, done.
Counting objects: 100% (25/25), done.
Delta compression using up to 8 threads
Compressing objects: 100% (20/20), done.
Writing objects: 100% (25/25), done.
To https://github.com/YOUR_USERNAME/Hydraa_Telangana.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

---

## Verify on GitHub

1. Go to https://github.com/YOUR_USERNAME/Hydraa_Telangana
2. Refresh page
3. You should see all your files listed
4. ✅ If you see files, GitHub step is complete!

---

## Next: Deploy to Railway (We'll do Phase 2 after this is confirmed)

# Deploying to Render.com (Free Tier with Auto-SSL)

## Prerequisites
- Your code pushed to GitHub (https://github.com/David-Van-Dyne/used-tires)
- Render.com account (free to create)

## Step-by-Step Deployment

### 1. Create Postgres Database

1. Go to [render.com](https://render.com) and log in
2. Click "New +" → "Postgres"
3. Configure:
   - **Name**: `used-tires-db`
   - **Database**: `tires_db`
   - **User**: (auto-generated)
   - **Region**: Choose closest to your location
   - **Plan**: **Free** (✓ 90-day expiration, but auto-renews)
4. Click "Create Database"
5. Wait for database to provision (~2 minutes)
6. Once created, scroll down to **"Connections"** section
7. Find **"Internal Database URL"** and click the copy icon
8. The URL looks like: `postgresql://username:password@dpg-xxxxx-internal/databasename`
9. Save this URL - you'll need it for the environment variables

**Important**: Use the **Internal** URL (ends with `-internal`), not the External URL.

### 2. Create Web Service

1. Click "New +" → "Web Service"
2. Choose "Build and deploy from a Git repository"
3. Connect your GitHub account if not already connected
4. Select repository: `David-Van-Dyne/used-tires`
5. Configure:
   - **Name**: `used-tires` (or any name - this becomes your URL)
   - **Region**: Same as your database
   - **Branch**: `main`
   - **Root Directory**: (leave empty)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python server.py`
   - **Plan**: **Free** (✓)
6. Click "Create Web Service" (don't worry about environment variables yet)

### 3. Add Environment Variables (After Service is Created)

1. Wait for the initial deployment to complete (it will fail - that's expected without the database)
2. On your web service dashboard, click **"Environment"** tab (left sidebar)
3. Click **"Add Environment Variable"** and add each of these:

**Required - Database Connection**:
```
Key: DATABASE_URL
Value: [paste the Internal Database URL you copied in step 1]
```
The value should look like: `postgresql://username:password@dpg-xxxxx-internal/databasename`

**Required - Admin Credentials**:
```
Key: ADMIN_USERNAME
Value: vandyneadmin
```
```
Key: ADMIN_PASSWORD
Value: wetpotatoehighnoon
```

**Optional - Email Notifications**:
```
Key: SMTP_HOST
Value: smtp.gmail.com
```
```
Key: SMTP_PORT
Value: 587
```
```
Key: SMTP_USER
Value: vandyneperformance@gmail.com
```
```
Key: SMTP_PASSWORD
Value: tksl kdzj bezr hbke
```
```
Key: FROM_EMAIL
Value: vandyneperformance@gmail.com
```

4. Click **"Save Changes"**
5. The service will automatically redeploy with the database connected

### 4. Deployment Complete!
Render will:
   - Clone your repo
   - Install dependencies
   - Create database tables automatically
   - Start your server

Wait ~2-3 minutes for deployment to complete.

### 5. Your App is Live! 🎉

Your URL will be: `https://used-tires.onrender.com` (or whatever name you chose)

**Features Automatically Enabled:**
- ✓ Free HTTPS/SSL certificate
- ✓ Auto-deploy on git push
- ✓ Database backups
- ✓ Server logs
- ✓ Custom domain support (if you have one)

## Accessing Your App

- **Public Store**: https://used-tires.onrender.com/web/
- **Admin Login**: https://used-tires.onrender.com/web/login.html
- **Admin Panel**: https://used-tires.onrender.com/web/admin.html
- **Orders Management**: https://used-tires.onrender.com/web/orders.html

## Important Notes

### Free Tier Limitations
1. **Spin-down**: After 15 minutes of inactivity, the server sleeps
   - First request after sleep takes ~30 seconds to wake up
   - Subsequent requests are instant
   - This is normal for free tier

2. **Database Expiration**: Free Postgres expires after 90 days
   - Render sends email reminders
   - Simply click "Renew" in dashboard (still free)
   - Your data is preserved

3. **Monthly Hours**: 750 hours/month (enough for 24/7 operation)

### Monitoring Your App

View in Render dashboard:
- **Logs**: Real-time server logs
- **Metrics**: CPU, memory, request count
- **Events**: Deployment history
- **Shell**: Access server terminal

### Updating Your App

Just push to GitHub:
```bash
git add .
git commit -m "Update feature"
git push
```

Render auto-deploys in ~2 minutes!

## Migrating Existing Data

If you have production data in JSON files:

1. Export data from production
2. Run locally:
   ```bash
   DATABASE_URL=<your-render-postgres-url> python migrate_to_db.py
   ```
3. This uploads your data directly to production database

## Troubleshooting

### "Application failed to respond"
- Check logs in Render dashboard
- Ensure `server.py` uses port from `PORT` env var (Render sets this)
- Add to server.py: `port = int(os.getenv('PORT', 8000))`

### Database Connection Errors
- Verify DATABASE_URL is set
- Check database is running (not paused)
- Ensure psycopg2-binary is in requirements.txt

### Can't Login
- Verify ADMIN_USERNAME and ADMIN_PASSWORD env vars
- Clear browser cookies
- Check logs for authentication errors

## Cost Summary

**Total: $0/month**
- Web Service: Free (750 hours)
- PostgreSQL: Free (expires 90 days, renew for free)
- SSL Certificate: Free
- Custom Domain: Free (if you own domain)

Perfect for a small business inventory system!

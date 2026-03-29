# HYDRAA Backend Setup Guide

## Overview
HYDRAA (Hyderabad Disaster Response & Asset Protection Agency) is a web-based complaint management system. This guide covers backend setup and deployment.

## 📋 Prerequisites
- **Node.js** v14+ and **npm** v6+
- **MySQL** 5.7+ or MariaDB
- **Git** (for version control)
- A code editor (VS Code recommended)

## 🚀 Installation Steps

### 1. Clone or Extract Project
```bash
cd HydraaHyderabad
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
```bash
# Create database using schema
mysql -u root -p < schema.sql

# Or run in MySQL CLI:
SOURCE schema.sql;
```

### 4. Environment Configuration
```bash
# Copy template
cp .env.example .env

# Edit .env with your values
nano .env
```

**Required .env variables:**
```
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hydraa
JWT_SECRET=your_secret_key_here
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 5. Start Server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

**Expected output:**
```
╔════════════════════════════════════════╗
║   HYDRAA API Server Started            ║
║   Port: 5000                           ║
║   Environment: development             ║
║   Status: ✅ Running                   ║
╚════════════════════════════════════════╝
```

## 📁 Project Structure
```
HydraaHyderabad/
├── server.js                 # Main server file
├── authRoutes.js            # Auth endpoints
├── authController.js        # Auth logic
├── complaintRoutes.js       # Complaint endpoints
├── complaintController.js   # Complaint logic
├── adminRoutes.js           # Admin endpoints
├── adminController.js       # Admin logic
├── auth.js                  # Middleware
├── db.js                    # Database config
├── package.json             # Dependencies
├── .env.example             # Environment template
├── schema.sql               # Database schema
└── emailService.js          # Email utilities
```

## 🔌 API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User login
- `POST /admin/login` - Admin login
- `POST /official/login` - Official login
- `GET /verify/:token` - Verify email
- `PUT /change-password` - Change password
- `POST /forgot-password` - Request password reset
- `POST /forgot-password/reset` - Reset password

### Complaints (`/api/complaints`)
- `POST /lodge` - Lodge new complaint
- `GET /track/:complaint_no` - Track complaint (public)
- `GET /my-complaints` - Get user's complaints
- `POST /rate` - Rate complaint
- `GET /admin/dashboard` - Admin dashboard data
- `PUT /admin/assign/:id` - Assign to official
- `PUT /admin/status/:id` - Update status
- `GET /official/assigned` - Get assigned complaints
- `PUT /official/resolve/:id` - Resolve complaint

### Admin (`/api/admin`)
- `GET /categories` - List categories
- `POST /categories` - Create category
- `DELETE /categories/:id` - Delete category
- `GET /subcategories` - List subcategories
- `POST /subcategories` - Create subcategory
- `DELETE /subcategories/:id` - Delete subcategory
- `GET /officials` - List officials
- `POST /officials` - Create official
- `PUT /officials/:id` - Update official
- `GET /users` - List users
- `GET /users/:id/logs` - Get user activity logs
- `GET /states` - List states

## 🔐 Authentication
All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

The token is returned after login and stored in localStorage by frontend.

## 📧 Email Configuration
To use email features (welcome email, password reset, etc.):

### Gmail Setup
1. Enable 2-Factor Authentication
2. Create App Password
3. Use in .env:
```
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_char_app_password
```

## 🗄️ Database Schema

### Main Tables
- `users` - Registered citizens
- `admins` - System administrators
- `officials` - Field officials
- `complaints` - Lodged complaints
- `complaint_history` - Status changes
- `complaint_ratings` - User ratings/feedback
- `categories` - Complaint types
- `subcategories` - Category subdivisions
- `states` - Indian states
- `user_logs` - Activity tracking

## 🧪 Testing

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Test User Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 🛠️ Troubleshooting

### Database Connection Error
```
❌ Database connection error: connect ECONNREFUSED
```
**Solution:** Check MySQL is running and credentials in .env are correct

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution:** Change PORT in .env or kill process on that port

### JWT Errors
**Invalid token:** Token may be expired or tampered
**Solution:** Re-login to get fresh token

### Email Not Sending
**Check:**
- Email credentials in .env
- Gmail App Password (not account password)
- 2FA enabled on Gmail
- Email in .env matches Gmail account

## 📊 Monitoring

### View Logs
```bash
# Development mode shows logs in console
npm run dev
```

### Database Queries
Enable query logging in db.js for debugging

## 🔄 Deployment

### Production Checklist
- [ ] Change `JWT_SECRET` to strong random string
- [ ] Set `NODE_ENV=production`
- [ ] Use environment-specific database
- [ ] Enable HTTPS
- [ ] Set up proper error logging
- [ ] Configure CORS for frontend URL
- [ ] Use process manager (PM2)

### Deploy with PM2
```bash
npm install -g pm2

pm2 start server.js --name "hydraa-api"
pm2 save
pm2 startup
```

## 📝 API Response Format

**Success:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description"
}
```

## 🤝 Support
For issues or questions, contact the HYDRAA development team.

## 📄 License
MIT License - HYDRAA Project

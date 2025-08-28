# =============================================================================
# YUS MONTESSORI SCHOOL MANAGEMENT SYSTEM - ENVIRONMENT VARIABLES
# =============================================================================
# Copy this file to .env and fill in your actual values
# NEVER commit the .env file to version control

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
MONGODB_URI=mongodb://localhost:27017/yus_montessori
DB_NAME=yus_montessori

# =============================================================================
# APPLICATION SETTINGS
# =============================================================================
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
API_BASE_URL=http://localhost:5000/api

# =============================================================================
# AUTHENTICATION & SECURITY
# =============================================================================
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
JWT_EXPIRES_IN=7d
SESSION_SECRET=your-session-secret-here
BCRYPT_SALT_ROUNDS=12

# =============================================================================
# EMAIL CONFIGURATION (Gmail Integration)
# =============================================================================
GMAIL_CLIENT_ID=your-gmail-client-id.googleusercontent.com
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN=your-gmail-refresh-token
GMAIL_USER=admin@yusmontessori.com
GMAIL_FROM_NAME=Yus Montessori School

# SMTP Fallback (if not using Gmail API)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=admin@yusmontessori.com
SMTP_PASS=your-email-app-password

# =============================================================================
# AI SERVICES
# =============================================================================
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# Claude AI (Alternative)
CLAUDE_API_KEY=your-claude-api-key-here

# =============================================================================
# PAYMENT PROCESSING (Stripe)
# =============================================================================
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key-here
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key-here
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret-here
STRIPE_SUCCESS_URL=http://localhost:3000/payment/success
STRIPE_CANCEL_URL=http://localhost:3000/payment/cancel

# =============================================================================
# FILE STORAGE
# =============================================================================
# Local storage settings
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760  # 10MB in bytes

# AWS S3 (if using cloud storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=yus-montessori-files

# =============================================================================
# CALENDAR INTEGRATION (Google Calendar)
# =============================================================================
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# =============================================================================
# NOTIFICATION SERVICES
# =============================================================================
# Twilio (for SMS notifications)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Push notifications (if implementing)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key

# =============================================================================
# LOGGING & MONITORING
# =============================================================================
LOG_LEVEL=info
LOG_FILE=./logs/app.log
ERROR_LOG_FILE=./logs/error.log

# Sentry (for error tracking)
SENTRY_DSN=your-sentry-dsn-url

# =============================================================================
# RATE LIMITING
# =============================================================================
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
API_RATE_LIMIT_MAX=1000

# =============================================================================
# SCHOOL-SPECIFIC SETTINGS
# =============================================================================
SCHOOL_NAME=Yus Montessori School
SCHOOL_EMAIL=admin@yusmontessori.com
SCHOOL_PHONE=+1-xxx-xxx-xxxx
SCHOOL_ADDRESS=123 School Street, Your City, Province, Postal Code
SCHOOL_WEBSITE=https://yusmontessori.com

# Academic year settings
ACADEMIC_YEAR_START=2024-09-01
ACADEMIC_YEAR_END=2025-06-30

# Tuition settings
DEFAULT_TUITION_AMOUNT=1200.00
LATE_PAYMENT_FEE=50.00
PAYMENT_DUE_DAY=1  # 1st of each month

# =============================================================================
# DEVELOPMENT & TESTING
# =============================================================================
# Test database (separate from production)
TEST_MONGODB_URI=mongodb://localhost:27017/yus_montessori_test

# Debug settings
DEBUG_MODE=true
VERBOSE_LOGGING=false

# =============================================================================
# BACKUP & MAINTENANCE
# =============================================================================
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM (cron format)
BACKUP_RETENTION_DAYS=30
MAINTENANCE_MODE=false
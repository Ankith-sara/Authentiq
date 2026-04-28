# Security Notes

## ⚠️ Before deploying

### 1. Rotate your Supabase credentials
The repository previously had secrets committed. Rotate them immediately:
- Supabase Dashboard → Settings → API → Regenerate keys
- Update your `.env` file with new values

### 2. .env is gitignored
`.env` is in `.gitignore`. Never commit it. Use `.env.example` as a template.

### 3. Lock CORS origins in production
Set the environment variable before starting the server:
```bash
ALLOWED_ORIGINS="https://yourdomain.com" uvicorn main:app
```

### 4. Rate limits in place
- `/check-full`: 15 requests/minute per IP
- `/check-plagiarism`, `/check-ai`: 20 requests/minute per IP
- `/upload-pdf`: 10 requests/minute per IP
- `/submit`: 30 requests/minute per IP

### 5. Run tests before deploying
```bash
cd backend
pytest tests/ -v
```

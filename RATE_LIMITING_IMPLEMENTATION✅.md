# Rate Limiting Implementation Guide

## 📋 What Was Implemented

### Overview
Rate limiting has been added to protect your API from abuse, brute force attacks, and excessive requests. The implementation uses `express-rate-limit` with different limits for different types of endpoints.

### Features Implemented

1. **Login Rate Limiting**
   - **Limit**: 5 attempts per 15 minutes
   - **Protection**: Prevents brute force attacks on login
   - **Tracking**: By email address or IP
   - **Action**: Marks IP as suspicious after limit exceeded

2. **General API Rate Limiting**
   - **Limit**: 100 requests per minute
   - **Protection**: Prevents API abuse
   - **Tracking**: By user ID (if authenticated) or IP
   - **Applied to**: Dashboard, team members, screenshots, reports, etc.

3. **Screenshot Upload Rate Limiting**
   - **Limit**: 10 uploads per minute
   - **Protection**: Prevents excessive file uploads
   - **Tracking**: By IP address

4. **Heartbeat Rate Limiting**
   - **Limit**: 60 requests per minute
   - **Protection**: Prevents excessive heartbeat requests
   - **Tracking**: By IP address

5. **IP-Based Security**
   - **Trusted IPs**: Whitelist via `TRUSTED_IPS` environment variable
   - **Suspicious IP Tracking**: Automatically blocks IPs that exceed limits
   - **Auto-removal**: Suspicious IPs are removed after 1 hour

6. **Rate Limit Headers**
   - Standard headers (`RateLimit-*`) included in all responses
   - Shows remaining requests and reset time

## 📁 Files Created/Modified

### New Files
- `server/middleware/rate-limit.ts` - Rate limiting middleware
- `server/types/express-rate-limit.d.ts` - TypeScript type definitions

### Modified Files
- `server/routes.ts` - Added rate limiters to routes
- `server/index.ts` - Added proxy trust configuration
- `package.json` - Added `express-rate-limit` dependency

## 🧪 How to Test Rate Limiting

### Prerequisites
1. Start your development server:
   ```bash
   npm run dev
   ```

2. Have Postman or another API client ready

### Test 1: Login Rate Limiting (5 attempts per 15 minutes) ✅

**Endpoint**: `POST /api/auth/login`

**Steps**:
1. Open Postman
2. Create a new POST request to `http://localhost:5000/api/auth/login`
3. Set body to JSON:
   ```json
   {
     "email": "test@example.com",
     "password": "wrongpassword"
   }
   ```
4. Send the request 6 times rapidly
5. **Expected Result**:
   - First 5 requests: Should return `401 Unauthorized` (invalid credentials)
   - 6th request: Should return `429 Too Many Requests` with:
     ```json
     {
       "error": "Too many login attempts. Please try again after 15 minutes.",
       "retryAfter": 900
     }
     ```
   - Response headers should include:
     - `RateLimit-Limit: 5`
     - `RateLimit-Remaining: 0`
     - `RateLimit-Reset: <timestamp>`

**Verify**:
- Check response headers for rate limit information
- Try again after 15 minutes - should work again

### Test 2: API Rate Limiting (100 requests per minute)

**Endpoint**: `GET /api/dashboard/stats`

**Steps**:
1. Create a GET request to `http://localhost:5000/api/dashboard/stats`
2. Send the request 101 times rapidly (use Postman's "Runner" feature)
3. **Expected Result**:
   - First 100 requests: Should return `200 OK` with dashboard stats
   - 101st request: Should return `429 Too Many Requests`:
     ```json
     {
       "error": "Too many requests. Please slow down.",
       "retryAfter": 60
     }
     ```

**Alternative Test** (with authentication):
1. First, login to get an access token
2. Add `Authorization: Bearer <your-token>` header
3. Make 101 requests to any protected endpoint
4. Should see rate limiting based on user ID

### Test 3: Screenshot Upload Rate Limiting (10 per minute)

**Endpoint**: `POST /api/agent/screenshot`

**Steps**:
1. Get an agent token (register a device first)
2. Create POST request to `http://localhost:5000/api/agent/screenshot`
3. Add header: `Authorization: Bearer <agent-token>`
4. Set body with base64 image data
5. Send 11 requests rapidly
6. **Expected Result**:
   - First 10 requests: Should return `201 Created`
   - 11th request: Should return `429 Too Many Requests`

### Test 4: Heartbeat Rate Limiting (60 per minute)

**Endpoint**: `POST /api/agent/heartbeat`

**Steps**:
1. Get an agent token
2. Create POST request to `http://localhost:5000/api/agent/heartbeat`
3. Add header: `Authorization: Bearer <agent-token>`
4. Send 61 requests rapidly
5. **Expected Result**:
   - First 60 requests: Should return `200 OK`
   - 61st request: Should return `429 Too Many Requests`

### Test 5: Rate Limit Headers

**Steps**:
1. Make any API request
2. Check response headers for:
   - `RateLimit-Limit`: Maximum number of requests
   - `RateLimit-Remaining`: Remaining requests in window
   - `RateLimit-Reset`: Timestamp when limit resets

**Example Headers**:
```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1706123456
```

### Test 6: Trusted IP Whitelist

**Steps**:
1. Set environment variable:
   ```bash
   export TRUSTED_IPS=127.0.0.1,::1
   ```
   Or in `.env` file:
   ```
   TRUSTED_IPS=127.0.0.1,::1
   ```
2. Restart server
3. Make requests from whitelisted IP
4. **Expected Result**: Should bypass rate limits

### Test 7: Suspicious IP Blocking

**Steps**:
1. Exceed rate limit from a specific IP
2. That IP should be marked as suspicious
3. Subsequent requests from that IP should be blocked
4. Wait 1 hour - IP should be automatically unblocked

## 🔧 Configuration

### Environment Variables

```bash
# Trusted IPs (comma-separated)
TRUSTED_IPS=127.0.0.1,192.168.1.100,::1
```

### Adjusting Rate Limits

Edit `server/middleware/rate-limit.ts`:

```typescript
// Login: Change from 5 to 10 attempts
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Changed from 5
  // ...
});

// API: Change from 100 to 200 requests
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200, // Changed from 100
  // ...
});
```

## 📊 Monitoring Rate Limits

### Check Rate Limit Status

Rate limit information is included in response headers:

```javascript
// Example: Check remaining requests
const response = await fetch('/api/dashboard/stats');
const remaining = response.headers.get('RateLimit-Remaining');
const resetTime = response.headers.get('RateLimit-Reset');

console.log(`Remaining: ${remaining}, Resets at: ${new Date(resetTime * 1000)}`);
```

### Logging

Rate limit violations are automatically logged. Check your server logs for:
- `429` status codes
- Rate limit error messages

## 🐛 Troubleshooting

### Issue: Rate limits not working
- **Solution**: Ensure `app.set("trust proxy", 1)` is set in `server/index.ts`
- Check that rate limiters are imported and applied to routes

### Issue: Getting rate limited from localhost
- **Solution**: Add `127.0.0.1` and `::1` to `TRUSTED_IPS` environment variable

### Issue: Rate limits too strict
- **Solution**: Adjust limits in `server/middleware/rate-limit.ts`

### Issue: IP detection not working behind proxy
- **Solution**: Ensure `app.set("trust proxy", 1)` is configured correctly
- Check that `X-Forwarded-For` header is being passed

## 📝 Notes

- Rate limits are stored in memory (will reset on server restart)
- For production, consider using Redis for distributed rate limiting
- Suspicious IPs are automatically removed after 1 hour
- Rate limit windows are sliding windows (not fixed windows)

## 🚀 Production Considerations

1. **Use Redis Store**: For distributed systems, use Redis to store rate limit data
2. **Monitoring**: Set up alerts for high rate limit violations
3. **Adjust Limits**: Tune limits based on actual usage patterns
4. **Whitelist**: Add known good IPs to `TRUSTED_IPS`

---

## 📄 About fix-user-roles.ts

### Purpose
The `script/fix-user-roles.ts` file is a utility script to fix database migration issues related to user roles.

### When to Use
Run this script **before** running `npm run db:push` if you encounter this error:
```
error: invalid input value for enum user_role: "user"
```

### What It Does
1. Checks for users with invalid roles (not "admin", "manager", or "viewer")
2. Updates all invalid roles to "viewer" (the default role)
3. Reports how many users were updated

### How to Run

```bash
# Option 1: Using npm script (if configured)
npm run db:fix-roles

# Option 2: Direct execution
npx tsx script/fix-user-roles.ts
```

### Example Output

```
Fixing user roles...
Found 2 users with invalid roles
Users to update:
  - user1@example.com: 'user' -> 'viewer'
  - user2@example.com: 'old_role' -> 'viewer'
✅ Updated 2 user(s) to 'viewer' role

✅ User roles fixed! You can now run 'npm run db:push'
```

### Important Notes
- This script should be run **before** database migrations
- It uses raw SQL to update roles before the enum constraint is applied
- The script automatically closes the database connection when done
- It's safe to run multiple times (idempotent)

### Related Files
- `shared/schema.ts` - Defines the user role enum
- `server/db.ts` - Database connection used by the script

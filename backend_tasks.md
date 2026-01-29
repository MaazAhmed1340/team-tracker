# Backend Optimization Tasks

This document lists all missing features and optimization opportunities for the TeamTrack backend server. Each task is broken down into simple, actionable steps.

## 🔐 Authentication & Authorization

### Task 1: Add User Authentication System ✅
**Priority: HIGH** | **Estimated Time: 6-8 hours**

**What's Missing:** Currently, there's no authentication. Anyone can access the API.

**Step-by-Step:**
1. Add user table to database schema
   - Create `users` table with email, password hash, role
   - Add foreign key from team_members to users
   - Add indexes on email and user_id
   
2. Add password hashing
   - Use bcrypt to hash passwords
   - Store salt with password
   - Add password strength validation
   
3. Create authentication middleware
   - Verify JWT tokens
   - Extract user from token
   - Add to request object
   
4. Create login endpoint
   - POST `/api/auth/login`
   - Validate email and password
   - Return JWT token
   - Set refresh token in cookie
   
5. Create registration endpoint
   - POST `/api/auth/register`
   - Validate input
   - Hash password
   - Create user and team member
   - Return token
   
6. Create logout endpoint
   - POST `/api/auth/logout`
   - Invalidate refresh token
   - Clear cookies
   
7. Add token refresh endpoint
   - POST `/api/auth/refresh`
   - Validate refresh token
   - Issue new access token
   - Return new token

**Files to Create/Modify:**
- `shared/schema.ts` (add users table)
- `server/middleware/auth.ts` (new)
- `server/routes.ts` (add auth routes)
- `server/storage.ts` (add user methods)

---

### Task 2: Add Role-Based Access Control ✅
**Priority: HIGH** | **Estimated Time: 4-5 hours**

**What's Missing:** No way to control who can do what.

**Step-by-Step:**
1. Add roles to user table
   - Admin: Full access
   - Manager: Can manage team members
   - Viewer: Read-only access
   
2. Create permission middleware
   - Check user role
   - Check if user can perform action
   - Return 403 if not allowed
   
3. Protect routes by role
   - Settings: Admin only
   - Add member: Admin or Manager
   - Delete member: Admin only
   - View reports: All authenticated users
   
4. Add permission checks to storage methods
   - Check before deleting
   - Check before updating settings
   - Check before creating members

**Files to Create/Modify:**
- `server/middleware/permissions.ts` (new)
- `server/routes.ts` (add permission checks)
- `shared/schema.ts` (add role enum)

---

## 🛡️ Security Improvements

### Task 3: Add Rate Limiting ✅
**Priority: HIGH** | **Estimated Time: 2-3 hours**

**What's Missing:** No protection against too many requests.

**Step-by-Step:**
1. Install rate limiting library
   - Use express-rate-limit
   - Configure per route
   
2. Add rate limits
   - Login: 5 attempts per 15 minutes
   - API calls: 100 per minute
   - Screenshot upload: 10 per minute
   - Heartbeat: 60 per minute
   
3. Add rate limit headers
   - Show remaining requests
   - Show reset time
   - Return 429 when exceeded
   
4. Add IP-based rate limiting
   - Track by IP address
   - Block suspicious IPs
   - Whitelist trusted IPs

**Files to Create/Modify:**
- `server/middleware/rate-limit.ts` (new)
- `server/routes.ts` (add rate limit middleware)
- `server/index.ts` (configure rate limiter)

---

### Task 4: Add Input Validation & Sanitization ✅
**Priority: HIGH** | **Estimated Time: 3-4 hours**

**What's Missing:** Some inputs aren't validated properly.

**Step-by-Step:**
1. Add validation to all endpoints
   - Validate email format
   - Validate date ranges
   - Validate file sizes
   - Validate string lengths
   
2. Sanitize all inputs
   - Remove HTML tags
   - Escape special characters
   - Trim whitespace
   - Validate file types
   
3. Add validation error messages
   - Clear error messages
   - Show which field has error
   - Show expected format
   
4. Add file upload validation
   - Check file size (max 5MB)
   - Check file type (images only)
   - Scan for malware (optional)
   - Validate image dimensions

**Files to Modify:**
- `server/routes.ts` (add validation to all routes)
- Create validation schemas for each endpoint
- Add sanitization library (validator.js)

---

### Task 5: Add CORS Configuration ✅
**Priority: MEDIUM** | **Estimated Time: 1 hour**  

**What's Missing:** CORS might not be configured properly.

**Step-by-Step:**
1. Configure CORS middleware
   - Allow specific origins only
   - Allow credentials
   - Set allowed methods
   - Set allowed headers
   
2. Add environment-based CORS
   - Different origins for dev/prod
   - Allow localhost in development
   - Restrict in production
   
3. Add preflight handling
   - Handle OPTIONS requests
   - Return proper headers
   - Cache preflight responses

**Files to Modify:**
- `server/index.ts` (add CORS middleware)
- Add cors library configuration

---

## 📊 Database Optimizations

### Task 6: Add Database Indexes
**Priority: HIGH** | **Estimated Time: 2-3 hours**

**What's Missing:** Queries might be slow without proper indexes.

**Step-by-Step:**
1. Analyze slow queries
   - Find queries taking > 100ms
   - Check query plans
   - Identify missing indexes
   
2. Add indexes to schema
   - Index on team_member_id in screenshots
   - Index on captured_at in screenshots
   - Index on team_member_id in time_entries
   - Index on start_time in time_entries
   - Index on email in team_members
   - Index on token in agent_tokens
   
3. Add composite indexes
   - Index on (team_member_id, captured_at)
   - Index on (team_member_id, start_time)
   - Index on (is_active, team_member_id)
   
4. Monitor index usage
   - Check if indexes are used
   - Remove unused indexes
   - Update statistics

**Files to Modify:**
- `shared/schema.ts` (add index definitions)
- Run migration to add indexes

---

### Task 7: Add Database Connection Pooling
**Priority: MEDIUM** | **Estimated Time: 1-2 hours**

**What's Missing:** Database connections might not be pooled efficiently.

**Step-by-Step:**
1. Configure connection pool
   - Set min connections: 2
   - Set max connections: 10
   - Set idle timeout: 30 seconds
   - Set connection timeout: 10 seconds
   
2. Monitor connection usage
   - Log connection pool stats
   - Alert if pool exhausted
   - Track connection wait times
   
3. Add connection retry logic
   - Retry on connection failure
   - Exponential backoff
   - Max retry attempts: 3

**Files to Modify:**
- `server/db.ts` (configure pool)
- Add connection monitoring

---

### Task 8: Add Query Optimization
**Priority: MEDIUM** | **Estimated Time: 3-4 hours**

**What's Missing:** Some queries might be inefficient.

**Step-by-Step:**
1. Optimize getTeamMembersWithStats
   - Use JOIN instead of multiple queries
   - Use aggregate functions
   - Cache results for 1 minute
   
2. Optimize getAllScreenshots
   - Add pagination
   - Use cursor-based pagination
   - Limit results to 100
   
3. Optimize getTimeline
   - Use database date functions
   - Group by hour in SQL
   - Cache results
   
4. Add query logging
   - Log slow queries (> 100ms)
   - Log query plans
   - Alert on very slow queries (> 1s)

**Files to Modify:**
- `server/storage.ts` (optimize all queries)
- Add query logging middleware

---

## 🗄️ Data Management

### Task 9: Add Data Retention Policies
**Priority: MEDIUM** | **Estimated Time: 3-4 hours**

**What's Missing:** Old data accumulates forever, filling up storage.

**Step-by-Step:**
1. Add retention settings
   - Screenshots: Keep for 30/60/90 days
   - Time entries: Keep for 1 year
   - Activity logs: Keep for 90 days
   - App usage: Keep for 90 days
   
2. Create cleanup job
   - Run daily at 2 AM
   - Delete old screenshots
   - Delete old activity logs
   - Archive old time entries
   
3. Add soft delete
   - Mark as deleted instead of deleting
   - Keep for 7 days before hard delete
   - Allow recovery within 7 days
   
4. Add data export before deletion
   - Export to CSV before deleting
   - Store export for 30 days
   - Notify admin before deletion

**Files to Create/Modify:**
- `server/jobs/cleanup.ts` (new)
- `server/storage.ts` (add cleanup methods)
- `server/routes.ts` (add retention settings endpoint)

---

### Task 10: Add Backup System
**Priority: HIGH** | **Estimated Time: 4-5 hours**

**What's Missing:** No backup system. Data loss would be catastrophic.

**Step-by-Step:**
1. Create backup script
   - Backup database daily
   - Backup uploaded files
   - Compress backups
   - Store with timestamp
   
2. Add backup storage
   - Store locally for 7 days
   - Upload to cloud storage (S3, etc.)
   - Keep cloud backups for 30 days
   
3. Add backup verification
   - Verify backup integrity
   - Test restore process
   - Alert if backup fails
   
4. Add restore endpoint
   - Restore from backup
   - Select backup date
   - Confirm before restore
   - Log restore operations

**Files to Create:**
- `server/scripts/backup.ts` (new)
- `server/routes.ts` (add backup/restore endpoints)
- Add backup scheduling (cron job)

---

### Task 11: Add Image Compression
**Priority: MEDIUM** | **Estimated Time: 3-4 hours**

**What's Missing:** Screenshots are stored at full size, using lots of storage.

**Step-by-Step:**
1. Add image compression on upload
   - Compress PNG to JPEG
   - Reduce quality to 80%
   - Resize if too large (max 1920x1080)
   - Keep original for 24 hours, then delete
   
2. Add thumbnail generation
   - Generate 300x200 thumbnail
   - Generate 150x100 thumbnail
   - Store thumbnails separately
   - Serve thumbnails in lists
   
3. Add progressive image loading
   - Generate low-quality preview
   - Load full image on demand
   - Show loading indicator
   
4. Add image optimization library
   - Use sharp or similar
   - Batch process old images
   - Monitor compression ratio

**Files to Create/Modify:**
- `server/utils/image-processing.ts` (new)
- `server/routes.ts` (add compression to screenshot upload)
- Add image processing library

---

## 📡 API Improvements

### Task 12: Add API Versioning
**Priority: LOW** | **Estimated Time: 2-3 hours**

**What's Missing:** No API versioning. Breaking changes affect all clients.

**Step-by-Step:**
1. Add version to API routes
   - `/api/v1/team-members`
   - `/api/v1/screenshots`
   - Keep `/api/` as latest version
   
2. Add version header
   - Accept-Version header
   - Default to v1 if not specified
   - Return version in response
   
3. Add version documentation
   - Document each version
   - List breaking changes
   - Show migration guide
   
4. Add deprecation warnings
   - Warn when using old version
   - Set deprecation date
   - Remove after grace period

**Files to Modify:**
- `server/routes.ts` (add version prefix)
- Update all API calls
- Add version middleware

---

### Task 13: Add API Documentation
**Priority: MEDIUM** | **Estimated Time: 3-4 hours**

**What's Missing:** No API documentation. Hard for developers to use.

**Step-by-Step:**
1. Set up Swagger/OpenAPI
   - Install swagger-ui-express
   - Create OpenAPI schema
   - Document all endpoints
   
2. Document each endpoint
   - Request/response schemas
   - Authentication requirements
   - Example requests
   - Error responses
   
3. Add interactive API explorer
   - Test endpoints in browser
   - See request/response examples
   - Try authentication
   
4. Add API changelog
   - Document new endpoints
   - Document breaking changes
   - Document deprecations

**Files to Create/Modify:**
- `server/docs/openapi.yaml` (new)
- `server/routes.ts` (add Swagger setup)
- Add swagger-ui-express

---

### Task 14: Add Health Check Endpoint
**Priority: MEDIUM** | **Estimated Time: 1 hour**

**What's Missing:** No way to check if server is healthy.

**Step-by-Step:**
1. Create health check endpoint
   - GET `/api/health`
   - Return 200 if healthy
   - Return 503 if unhealthy
   
2. Check system health
   - Database connection
   - Disk space
   - Memory usage
   - Response time
   
3. Add detailed health endpoint
   - GET `/api/health/detailed`
   - Return all health metrics
   - Include version info
   - Include uptime
   
4. Add monitoring integration
   - Ping endpoint every minute
   - Alert if unhealthy
   - Track uptime

**Files to Create/Modify:**
- `server/routes.ts` (add health endpoints)
- `server/utils/health-check.ts` (new)

---

## 📧 Notifications & Webhooks

### Task 15: Add Email Notifications
**Priority: MEDIUM** | **Estimated Time: 4-5 hours**

**What's Missing:** No way to send email notifications.

**Step-by-Step:**
1. Set up email service
   - Use SendGrid, AWS SES, or similar
   - Configure SMTP settings
   - Add email templates
   
2. Create email templates
   - Welcome email
   - Idle alert email
   - Daily summary email
   - Weekly report email
   
3. Add notification triggers
   - Send when member goes idle > 30 min
   - Send daily summary at 9 AM
   - Send weekly report on Monday
   - Send when screenshot fails
   
4. Add email preferences
   - User can opt out
   - User can choose frequency
   - User can choose notification types
   
5. Add email queue
   - Queue emails for sending
   - Retry failed sends
   - Track delivery status

**Files to Create:**
- `server/services/email.ts` (new)
- `server/jobs/email-sender.ts` (new)
- `server/routes.ts` (add email preferences)

---

### Task 16: Add Webhook Support
**Priority: LOW** | **Estimated Time: 3-4 hours**

**What's Missing:** No way to integrate with other services.

**Step-by-Step:**
1. Create webhook system
   - Store webhook URLs
   - Store webhook secrets
   - Store event types to send
   
2. Add webhook events
   - Screenshot added
   - Member status changed
   - Timer started/stopped
   - Member added/removed
   
3. Send webhook payloads
   - POST to webhook URL
   - Include event data
   - Sign payload with secret
   - Retry on failure (3 times)
   
4. Add webhook management
   - Create webhook endpoint
   - List webhooks
   - Test webhook
   - Delete webhook
   - View webhook logs

**Files to Create:**
- `server/services/webhooks.ts` (new)
- `server/routes.ts` (add webhook endpoints)
- `shared/schema.ts` (add webhooks table)

---

## 📈 Monitoring & Logging

### Task 17: Add Request Logging
**Priority: MEDIUM** | **Estimated Time: 2-3 hours**

**What's Missing:** Limited logging. Hard to debug issues.

**Step-by-Step:**
1. Add structured logging
   - Use winston or pino
   - Log all requests
   - Log request duration
   - Log response status
   
2. Add log levels
   - Error: Only errors
   - Warn: Warnings and errors
   - Info: Info, warnings, errors
   - Debug: Everything
   
3. Add log rotation
   - Rotate daily
   - Keep for 30 days
   - Compress old logs
   - Delete very old logs
   
4. Add log aggregation
   - Send to logging service (optional)
   - Search logs
   - Set up alerts
   - Create dashboards

**Files to Modify:**
- `server/index.ts` (add logging middleware)
- `server/utils/logger.ts` (new)
- Add logging library

---

### Task 18: Add Performance Monitoring
**Priority: MEDIUM** | **Estimated Time: 3-4 hours**

**What's Missing:** No way to track server performance.

**Step-by-Step:**
1. Add performance metrics
   - Track request duration
   - Track database query time
   - Track memory usage
   - Track CPU usage
   
2. Add metrics endpoint
   - GET `/api/metrics`
   - Return Prometheus format
   - Include all metrics
   
3. Add performance alerts
   - Alert if response time > 1s
   - Alert if memory > 80%
   - Alert if CPU > 80%
   - Alert if error rate > 5%
   
4. Add performance dashboard
   - Show request rates
   - Show response times
   - Show error rates
   - Show resource usage

**Files to Create:**
- `server/middleware/metrics.ts` (new)
- `server/routes.ts` (add metrics endpoint)
- Add metrics library (prom-client)

---

### Task 19: Add Error Tracking
**Priority: HIGH** | **Estimated Time: 2-3 hours**

**What's Missing:** Errors aren't tracked properly.

**Step-by-Step:**
1. Add error tracking service
   - Use Sentry or similar
   - Capture all errors
   - Include stack traces
   - Include request context
   
2. Add error logging
   - Log to file
   - Log to console
   - Send to error tracking service
   
3. Add error alerts
   - Email on critical errors
   - Slack notification (optional)
   - Rate limit alerts
   
4. Add error dashboard
   - View all errors
   - Group similar errors
   - Mark as resolved
   - Track error trends

**Files to Create/Modify:**
- `server/utils/error-handler.ts` (new)
- `server/index.ts` (add error handler)
- Add Sentry or similar

---

## 🔄 Real-Time Features

### Task 20: Improve WebSocket Implementation
**Priority: MEDIUM** | **Estimated Time: 3-4 hours**

**What's Missing:** WebSocket could be more robust.

**Step-by-Step:**
1. Add WebSocket authentication
   - Verify token on connection
   - Reject if invalid
   - Track connected users
   
2. Add WebSocket rooms
   - Room per team member
   - Room for admins
   - Room for all users
   - Send to specific rooms
   
3. Add reconnection logic
   - Auto-reconnect on disconnect
   - Exponential backoff
   - Max reconnection attempts
   
4. Add WebSocket heartbeat
   - Ping every 30 seconds
   - Close if no pong received
   - Track connection status
   
5. Add message queuing
   - Queue messages if client disconnected
   - Send queued messages on reconnect
   - Limit queue size

**Files to Modify:**
- `server/routes.ts` (improve WebSocket implementation)
- Add WebSocket authentication
- Add room management

---

## 🧪 Testing & Quality

### Task 21: Add API Tests
**Priority: MEDIUM** | **Estimated Time: 4-5 hours**

**What's Missing:** No automated tests. Changes might break things.

**Step-by-Step:**
1. Set up testing framework
   - Install Jest or Mocha
   - Install supertest for API testing
   - Create test database
   
2. Write tests for endpoints
   - Test all GET endpoints
   - Test all POST endpoints
   - Test all PUT/PATCH endpoints
   - Test all DELETE endpoints
   
3. Write tests for edge cases
   - Test invalid inputs
   - Test missing authentication
   - Test permission checks
   - Test rate limiting
   
4. Add test coverage
   - Aim for 80% coverage
   - Track coverage over time
   - Fail build if coverage drops

**Files to Create:**
- `server/tests/` (new directory)
- `server/tests/api.test.ts` (new)
- `server/tests/setup.ts` (new)
- Add test scripts to package.json

---

### Task 22: Add Input Validation Tests
**Priority: MEDIUM** | **Estimated Time: 2-3 hours**

**What's Missing:** Validation might not catch all edge cases.

**Step-by-Step:**
1. Test all validation rules
   - Test email validation
   - Test date validation
   - Test file size validation
   - Test string length validation
   
2. Test SQL injection prevention
   - Try SQL injection attacks
   - Verify they're blocked
   - Test parameterized queries
   
3. Test XSS prevention
   - Try XSS attacks
   - Verify they're sanitized
   - Test output encoding

**Files to Create:**
- `server/tests/validation.test.ts` (new)
- `server/tests/security.test.ts` (new)

---

## Summary

**Total Tasks: 22**
**High Priority: 6**
**Medium Priority: 13**
**Low Priority: 3**

**Estimated Total Time: 60-80 hours**

Start with authentication and security tasks first. They are critical for a production application.

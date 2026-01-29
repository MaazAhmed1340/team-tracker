# Role-Based Access Control (RBAC) Testing Guide

This guide will help you test the Role-Based Access Control system with different user roles.

## Prerequisites

1. Server should be running: `npm run dev`
2. Database migration should be run: `npm run db:push` (to update users table with role enum)
3. Postman or similar API testing tool

## User Roles

- **Admin**: Full access to all features
- **Manager**: Can add team members and view reports (cannot delete members or manage settings)
- **Viewer**: Read-only access (can only view reports)

## Step 1: Create Test Users

### Create an Admin User ✅

**Request:**
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "email": "admin@test.com",
  "password": "admin123456",
  "role": "admin"
}
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@test.com",
    "role": "admin"
  },
  "teamMember": {
    "id": "uuid",
    "name": "admin",
    "email": "admin@test.com"
  }
}
```

**Save the `accessToken` for later use as `ADMIN_TOKEN`**

### Create a Manager User ✅

**Request:**
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "email": "manager@test.com",
  "password": "manager123456",
  "role": "manager"
}
```

**Save the `accessToken` for later use as `MANAGER_TOKEN`**

### Create a Viewer User ✅

**Request:**
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "email": "viewer@test.com",
  "password": "viewer123456",
  "role": "viewer"
}
```

**Or register without specifying role (defaults to viewer):**
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "email": "viewer2@test.com",
  "password": "viewer123456"
}
```

**Save the `accessToken` for later use as `VIEWER_TOKEN`**

---

## Step 2: Test Settings Endpoints (Admin Only) ✅

### Test 1: Get Settings as Admin ✅

**Request:**
```http
GET http://localhost:5000/api/settings
Authorization: Bearer {ADMIN_TOKEN}
```

**Expected Response:** `200 OK` with settings object

### Test 2: Get Settings as Manager ❌

**Request:**
```http
GET http://localhost:5000/api/settings
Authorization: Bearer {MANAGER_TOKEN}
```

**Expected Response:** `403 Forbidden`
```json
{
  "error": "Insufficient permissions",
  "required": ["admin"],
  "current": "manager"
}
```

### Test 3: Get Settings as Viewer ❌

**Request:**
```http
GET http://localhost:5000/api/settings
Authorization: Bearer {VIEWER_TOKEN}
```

**Expected Response:** `403 Forbidden`

### Test 4: Update Settings as Admin ✅

**Request:**
```http
PUT http://localhost:5000/api/settings
Authorization: Bearer {ADMIN_TOKEN}
Content-Type: application/json

{
  "screenshotInterval": 10,
  "enableActivityTracking": true
}
```

**Expected Response:** `200 OK` with updated settings

### Test 5: Update Settings as Manager ❌

**Request:**
```http
PUT http://localhost:5000/api/settings
Authorization: Bearer {MANAGER_TOKEN}
Content-Type: application/json

{
  "screenshotInterval": 10
}
```

**Expected Response:** `403 Forbidden`

---

## Step 3: Test Team Member Management  ✅

### Test 6: Add Team Member as Admin ✅

**Request:**
```http
POST http://localhost:5000/api/team-members
Authorization: Bearer {ADMIN_TOKEN}
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "member"
}
```

**Expected Response:** `201 Created` with team member object

**Save the team member `id` for later tests as `TEAM_MEMBER_ID`**

### Test 7: Add Team Member as Manager ✅

**Request:**
```http
POST http://localhost:5000/api/team-members
Authorization: Bearer {MANAGER_TOKEN}
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "member"
}
```

**Expected Response:** `201 Created`

### Test 8: Add Team Member as Viewer ❌

**Request:**
```http
POST http://localhost:5000/api/team-members
Authorization: Bearer {VIEWER_TOKEN}
Content-Type: application/json

{
  "name": "Bob Wilson",
  "email": "bob@example.com",
  "role": "member"
}
```

**Expected Response:** `403 Forbidden`
```json
{
  "error": "Insufficient permissions",
  "required": ["admin", "manager"],
  "current": "viewer"
}
```

### Test 9: Delete Team Member as Admin ✅

**Request:**
```http
DELETE http://localhost:5000/api/team-members/{TEAM_MEMBER_ID}
Authorization: Bearer {ADMIN_TOKEN}
```

**Expected Response:** `204 No Content`

### Test 10: Delete Team Member as Manager ❌

**Request:**
```http
DELETE http://localhost:5000/api/team-members/{TEAM_MEMBER_ID}
Authorization: Bearer {MANAGER_TOKEN}
```

**Expected Response:** `403 Forbidden`
```json
{
  "error": "Insufficient permissions",
  "required": ["admin"],
  "current": "manager"
}
```

### Test 11: Delete Team Member as Viewer ❌

**Request:**
```http
DELETE http://localhost:5000/api/team-members/{TEAM_MEMBER_ID}
Authorization: Bearer {VIEWER_TOKEN}
```

**Expected Response:** `403 Forbidden`

---

## Step 4: Test Reports Endpoint (All Authenticated Users)

### Test 12: View Reports as Admin ✅

**Request:**
```http
GET http://localhost:5000/api/reports?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer {ADMIN_TOKEN}
```

**Expected Response:** `200 OK` with report data

### Test 13: View Reports as Manager ✅

**Request:**
```http
GET http://localhost:5000/api/reports?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer {MANAGER_TOKEN}
```

**Expected Response:** `200 OK` with report data

### Test 14: View Reports as Viewer ✅

**Request:**
```http
GET http://localhost:5000/api/reports?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer {VIEWER_TOKEN}
```

**Expected Response:** `200 OK` with report data

### Test 15: View Reports Without Authentication ❌

**Request:**
```http
GET http://localhost:5000/api/reports?startDate=2024-01-01&endDate=2024-12-31
```

**Expected Response:** `401 Unauthorized`
```json
{
  "error": "Access token required"
}
```

---

## Step 5: Test Other Endpoints (Should Work for All Authenticated Users)

### Test 16: Get Dashboard Stats (No Auth Required)

**Request:**
```http
GET http://localhost:5000/api/dashboard/stats
```

**Expected Response:** `200 OK` (This endpoint is not protected)

### Test 17: Get Team Members (No Auth Required)

**Request:**
```http
GET http://localhost:5000/api/team-members
```

**Expected Response:** `200 OK` (This endpoint is not protected)

### Test 18: Get Current User Info

**Request:**
```http
GET http://localhost:5000/api/auth/me
Authorization: Bearer {ADMIN_TOKEN}
```

**Expected Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "admin@test.com",
  "role": "admin"
}
```

---

## Step 6: Test Permission Helper Functions

You can also test the permission helper functions programmatically. Here's a quick test script:

```typescript
import { 
  canManageTeamMembers, 
  canDeleteTeamMembers, 
  canManageSettings, 
  canViewReports 
} from "./server/middleware/permissions";

// Test Admin
console.log("Admin permissions:");
console.log("Can manage team members:", canManageTeamMembers("admin")); // true
console.log("Can delete team members:", canDeleteTeamMembers("admin")); // true
console.log("Can manage settings:", canManageSettings("admin")); // true
console.log("Can view reports:", canViewReports("admin")); // true

// Test Manager
console.log("\nManager permissions:");
console.log("Can manage team members:", canManageTeamMembers("manager")); // true
console.log("Can delete team members:", canDeleteTeamMembers("manager")); // false
console.log("Can manage settings:", canManageSettings("manager")); // false
console.log("Can view reports:", canViewReports("manager")); // true

// Test Viewer
console.log("\nViewer permissions:");
console.log("Can manage team members:", canManageTeamMembers("viewer")); // false
console.log("Can delete team members:", canDeleteTeamMembers("viewer")); // false
console.log("Can manage settings:", canManageSettings("viewer")); // false
console.log("Can view reports:", canViewReports("viewer")); // true
```

---

## Postman Collection Setup

### Environment Variables

Create a Postman environment with these variables:

```
BASE_URL: http://localhost:5000
ADMIN_TOKEN: (from Step 1)
MANAGER_TOKEN: (from Step 1)
VIEWER_TOKEN: (from Step 1)
TEAM_MEMBER_ID: (from Step 6)
```

### Pre-request Script for Auth

For endpoints requiring authentication, add this to the "Authorization" tab:
- Type: Bearer Token
- Token: `{{ADMIN_TOKEN}}` (or `{{MANAGER_TOKEN}}` / `{{VIEWER_TOKEN}}`)

---

## Quick Test Checklist

- [ ] Create admin user
- [ ] Create manager user
- [ ] Create viewer user
- [ ] Test settings GET as admin (should work)
- [ ] Test settings GET as manager (should fail with 403)
- [ ] Test settings GET as viewer (should fail with 403)
- [ ] Test settings PUT as admin (should work)
- [ ] Test settings PUT as manager (should fail with 403)
- [ ] Test add team member as admin (should work)
- [ ] Test add team member as manager (should work)
- [ ] Test add team member as viewer (should fail with 403)
- [ ] Test delete team member as admin (should work)
- [ ] Test delete team member as manager (should fail with 403)
- [ ] Test delete team member as viewer (should fail with 403)
- [ ] Test view reports as admin (should work)
- [ ] Test view reports as manager (should work)
- [ ] Test view reports as viewer (should work)
- [ ] Test view reports without auth (should fail with 401)

---

## Troubleshooting

### Issue: Getting 401 Unauthorized on all endpoints

**Solution:** Make sure you're including the `Authorization: Bearer {token}` header with a valid token.

### Issue: Getting 403 even though I'm an admin

**Solution:** 
1. Check that the user's role in the database is actually "admin" (not "user")
2. Make sure you're using a fresh token (login again to get a new token with updated role)
3. Verify the token contains the correct role by decoding it at jwt.io

### Issue: Role enum not found in database

**Solution:** Run the database migration:
```bash
npm run db:push
```

### Issue: Can't create users with specific roles

**Solution:** Make sure you're using the correct role values: `"admin"`, `"manager"`, or `"viewer"` (all lowercase).

---

## Database Verification

To verify user roles in the database, you can query:

```sql
SELECT id, email, role FROM users;
```

Expected output should show:
- admin@test.com with role: `admin`
- manager@test.com with role: `manager`
- viewer@test.com with role: `viewer`

---

## Summary

The RBAC system is working correctly if:

1. ✅ Admin can access all endpoints
2. ✅ Manager can add members and view reports, but cannot delete members or manage settings
3. ✅ Viewer can only view reports
4. ✅ All protected endpoints return 403 for unauthorized roles
5. ✅ All protected endpoints return 401 for unauthenticated requests

Happy testing! 🎉

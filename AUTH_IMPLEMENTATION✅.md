# Authentication System Implementation

## Overview
The authentication system has been successfully implemented with JWT-based authentication, password hashing, and refresh tokens.

## What Was Implemented

### 1. Database Schema (`shared/schema.ts`)
- Added `users` table with:
  - `id` (UUID primary key)
  - `email` (unique, indexed)
  - `passwordHash` (bcrypt hashed password)
  - `role` (default: "user")
  - `refreshToken` (for token refresh)
  - `createdAt` and `updatedAt` timestamps
- Added `userId` foreign key to `team_members` table
- Added indexes on `email` and `userId`

### 2. Authentication Middleware (`server/middleware/auth.ts`)
- `authenticateToken` - Verifies JWT access tokens
- `optionalAuth` - Optional authentication for public endpoints
- `generateAccessToken` - Creates 15-minute access tokens
- `generateRefreshToken` - Creates 7-day refresh tokens
- `verifyAccessToken` and `verifyRefreshToken` - Token verification functions

### 3. Storage Methods (`server/storage.ts`)
- `getUser(id)` - Get user by ID
- `getUserByEmail(email)` - Get user by email
- `createUser(userData)` - Create new user with hashed password
- `updateUserRefreshToken(userId, refreshToken)` - Update refresh token

### 4. Authentication Endpoints (`server/routes.ts`)

#### POST `/api/auth/register`
- Registers a new user
- Hashes password with bcrypt
- Creates associated team member
- Returns access token and refresh token (in cookie)

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "user" // optional, defaults to "user"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  },
  "teamMember": {
    "id": "uuid",
    "name": "user",
    "email": "user@example.com"
  }
}
```

#### POST `/api/auth/login`
- Authenticates user with email and password
- Returns access token and refresh token (in cookie)

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  }
}
```

#### POST `/api/auth/logout`
- Requires authentication (Bearer token)
- Invalidates refresh token
- Clears refresh token cookie

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### POST `/api/auth/refresh`
- Refreshes access token using refresh token
- Accepts refresh token from cookie or request body
- Returns new access token and refresh token

**Request Body (optional if cookie is set):**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### GET `/api/auth/me`
- Requires authentication (Bearer token)
- Returns current user information

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "user"
}
```

## Testing with Postman

### Step 1: Register a New User
1. Method: `POST`
2. URL: `http://localhost:5000/api/auth/register`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "email": "test@example.com",
  "password": "testpassword123"
}
```
5. Expected: 201 Created with accessToken and user info

### Step 2: Login
1. Method: `POST`
2. URL: `http://localhost:5000/api/auth/login`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "email": "test@example.com",
  "password": "testpassword123"
}
```
5. Expected: 200 OK with accessToken
6. Note: Check cookies for `refreshToken`

### Step 3: Get Current User (Protected Route)
1. Method: `GET`
2. URL: `http://localhost:5000/api/auth/me`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer <accessToken from login>`
4. Expected: 200 OK with user info

### Step 4: Refresh Token
1. Method: `POST`
2. URL: `http://localhost:5000/api/auth/refresh`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON) - if cookie not available:
```json
{
  "refreshToken": "<refreshToken from login>"
}
```
5. Expected: 200 OK with new accessToken

### Step 5: Logout
1. Method: `POST`
2. URL: `http://localhost:5000/api/auth/logout`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer <accessToken>`
4. Expected: 200 OK with success message

## Environment Variables

Add these to your `.env` file (optional, defaults provided):
```
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
```

## Database Migration

Before testing, run the database migration:
```bash
npm run db:push
```

Or manually:
```bash
npx drizzle-kit push
```

## Security Features

1. **Password Hashing**: Uses bcrypt with salt rounds of 10
2. **JWT Tokens**: Access tokens expire in 15 minutes, refresh tokens in 7 days
3. **HTTP-Only Cookies**: Refresh tokens stored in HTTP-only cookies (prevents XSS)
4. **Token Validation**: Both access and refresh tokens are validated
5. **Password Strength**: Minimum 8 characters required

## Next Steps

1. Run database migration to create the `users` table
2. Test all endpoints with Postman
3. Optionally protect other routes by adding `authenticateToken` middleware
4. Set proper `JWT_SECRET` and `JWT_REFRESH_SECRET` in production

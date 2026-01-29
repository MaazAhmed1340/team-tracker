# Input Validation & Sanitization Implementation Guide

## 📋 What Was Implemented

### Overview
Comprehensive input validation and sanitization has been added to protect your API from malicious inputs, injection attacks, and data corruption. All user inputs are now validated and sanitized before processing.

### Features Implemented

1. **Input Sanitization**
   - HTML tag removal
   - Special character escaping
   - Whitespace trimming
   - Recursive object sanitization

2. **Email Validation**
   - Format validation
   - Length checks (max 255 characters)
   - Email normalization (trim + lowercase)

3. **String Length Validation**
   - Min/max length checks
   - Field-specific error messages

4. **Date Range Validation**
   - Valid date format checking
   - Start date must be before end date
   - Clear error messages with expected format

5. **File Upload Validation**
   - Base64 image validation
   - File size limits (max 5MB)
   - Image type validation (JPEG, PNG, GIF, WebP)
   - MIME type checking

6. **Time Format Validation**
   - HH:mm format validation
   - Time range validation (start < end)

7. **Timezone Validation**
   - IANA timezone format checking

8. **UUID Validation**
   - UUID format validation for IDs

9. **Numeric Range Validation**
   - Min/max value checks

### Files Created/Modified

#### New Files
- `server/utils/validation.ts` - Validation utility functions
- `server/middleware/validation.ts` - Sanitization middleware

#### Modified Files
- `server/routes.ts` - Added validation and sanitization to routes
- `package.json` - Added `validator`, `dompurify`, `jsdom` dependencies

## 🧪 How to Test Validation & Sanitization

### Prerequisites
1. Start your development server:
   ```bash
   npm run dev
   ```

2. Have Postman or another API client ready

### Test 1: Email Validation

**Endpoint**: `POST /api/auth/register`

**Test Cases**:

1. **Invalid Email Format**
   ```json
   {
     "email": "notanemail",
     "password": "password123"
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "Email must be a valid email address (e.g., user@example.com)"
   }
   ```

2. **Empty Email**
   ```json
   {
     "email": "",
     "password": "password123"
   }
   ```
   **Expected**: `400 Bad Request` - Email validation error

3. **Email Too Long**
   ```json
   {
     "email": "a".repeat(256) + "@example.com",
     "password": "password123"
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "Email must be 255 characters or less"
   }
   ```

4. **Valid Email (should work)**
   ```json
   {
     "email": "test@example.com",
     "password": "password123"
   }
   ```
   **Expected**: `201 Created` - User registered successfully

### Test 2: Password Validation

**Endpoint**: `POST /api/auth/register`

**Test Cases**:

1. **Password Too Short**
   ```json
   {
     "email": "test@example.com",
     "password": "short"
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "Password must be at least 8 characters long"
   }
   ```

2. **Password Too Long**
   ```json
   {
     "email": "test@example.com",
     "password": "a".repeat(129)
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "Password must be 128 characters or less"
   }
   ```

### Test 3: HTML/Script Injection Protection

**Endpoint**: `POST /api/team-members`

**Test Case**:
```json
{
  "name": "<script>alert('XSS')</script>John",
  "email": "john@example.com"
}
```

**Expected**: 
- Input is sanitized (HTML tags removed)
- No script execution
- Name stored as: `John` (HTML tags removed)

**Verify**: Check the database or response - the name should be sanitized.

### Test 4: Date Range Validation

**Endpoint**: `GET /api/reports?startDate=2024-01-15&endDate=2024-01-10`

**Test Cases**:

1. **Invalid Date Range (end before start)**
   ```
   GET /api/reports?startDate=2024-01-15&endDate=2024-01-10
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "startDate must be before or equal to endDate"
   }
   ```

2. **Invalid Date Format**
   ```
   GET /api/reports?startDate=invalid&endDate=2024-01-15
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "startDate must be a valid date (format: YYYY-MM-DD or ISO 8601)"
   }
   ```

3. **Valid Date Range**
   ```
   GET /api/reports?startDate=2024-01-01&endDate=2024-01-31
   ```
   **Expected**: `200 OK` - Report generated successfully

### Test 5: File Upload Validation (Screenshot)

**Endpoint**: `POST /api/agent/screenshot`

**Test Cases**:

1. **Invalid Base64 Data**
   ```json
   {
     "imageData": "not-valid-base64"
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "Image data must be a valid base64 string or data URL"
   }
   ```

2. **Invalid Image Type**
   ```json
   {
     "imageData": "data:application/pdf;base64,JVBERi0xLjQK..."
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "File type must be one of: image/jpeg, image/jpg, image/png, image/gif, image/webp. Received: application/pdf"
   }
   ```

3. **File Too Large**
   ```json
   {
     "imageData": "data:image/png;base64," + "A".repeat(7000000) // ~5.2MB
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "File size must be 5MB or less. Current size: X.XXMB"
   }
   ```

4. **Valid Image**
   ```json
   {
     "imageData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
   }
   ```
   **Expected**: `201 Created` - Screenshot uploaded successfully

### Test 6: Time Format Validation

**Endpoint**: `PATCH /api/team-members/:id/privacy`

**Test Cases**:

1. **Invalid Time Format**
   ```json
   {
     "workHoursStart": "25:00"
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "workHoursStart must be in HH:mm format (e.g., 09:00, 17:30)"
   }
   ```

2. **Invalid Time Range**
   ```json
   {
     "workHoursStart": "17:00",
     "workHoursEnd": "09:00"
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "workHoursStart must be before workHoursEnd"
   }
   ```

3. **Valid Time**
   ```json
   {
     "workHoursStart": "09:00",
     "workHoursEnd": "17:00"
   }
   ```
   **Expected**: `200 OK` - Settings updated successfully

### Test 7: Timezone Validation

**Endpoint**: `PATCH /api/team-members/:id/privacy`

**Test Cases**:

1. **Invalid Timezone**
   ```json
   {
     "workHoursTimezone": "invalid-timezone"
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "Timezone must be a valid IANA timezone (e.g., America/New_York, UTC)"
   }
   ```

2. **Valid Timezone**
   ```json
   {
     "workHoursTimezone": "America/New_York"
   }
   ```
   **Expected**: `200 OK` - Settings updated successfully

### Test 8: UUID Validation

**Endpoint**: `PATCH /api/team-members/:id/privacy`

**Test Case**:
```
PATCH /api/team-members/invalid-uuid/privacy
```

**Expected**: `400 Bad Request`
```json
{
  "error": "Team member ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"
}
```

### Test 9: Numeric Range Validation

**Endpoint**: `PUT /api/settings`

**Test Cases**:

1. **Screenshot Interval Too High**
   ```json
   {
     "screenshotInterval": 100
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "screenshotInterval must be 60 seconds or less"
   }
   ```

2. **Idle Threshold Too High**
   ```json
   {
     "idleThreshold": 50
   }
   ```
   **Expected**: `400 Bad Request`
   ```json
   {
     "error": "idleThreshold must be 30 minutes or less"
   }
   ```

### Test 10: String Length Validation

**Endpoint**: `POST /api/team-members`

**Test Case**:
```json
{
  "name": "A".repeat(256),
  "email": "test@example.com"
}
```

**Expected**: `400 Bad Request`
```json
{
  "error": "Name must be 255 characters or less"
}
```

## 🔍 Verification Checklist

### Sanitization Tests
- [ ] HTML tags are removed from inputs
- [ ] Special characters are escaped
- [ ] Whitespace is trimmed
- [ ] Script tags don't execute

### Validation Tests
- [ ] Invalid emails are rejected
- [ ] Invalid dates are rejected
- [ ] Invalid file types are rejected
- [ ] Files over size limit are rejected
- [ ] Invalid time formats are rejected
- [ ] Invalid UUIDs are rejected
- [ ] Out-of-range numbers are rejected

### Error Messages
- [ ] Error messages are clear and specific
- [ ] Error messages show which field has the error
- [ ] Error messages show expected format
- [ ] Error messages are user-friendly

## 📝 Example Test Scenarios

### Scenario 1: Registration with Malicious Input
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "<script>alert('xss')</script>test@example.com",
  "password": "password123"
}
```

**Expected Behavior**:
- Email is sanitized to: `test@example.com`
- Script tags are removed
- Registration succeeds (if email format is valid after sanitization)

### Scenario 2: Team Member Creation with XSS
```bash
POST /api/team-members
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "<img src=x onerror=alert(1)>John",
  "email": "john@example.com"
}
```

**Expected Behavior**:
- Name is sanitized to: `John`
- No XSS attack occurs
- Member is created successfully

### Scenario 3: Report with Invalid Dates
```bash
GET /api/reports?startDate=2024-13-45&endDate=invalid-date
Authorization: Bearer <token>
```

**Expected Behavior**:
- Returns `400 Bad Request`
- Clear error message about date format

## 🛠️ Configuration

### Adjusting Validation Rules

Edit `server/utils/validation.ts`:

```typescript
// Change max file size from 5MB to 10MB
export function validateFileSize(sizeInBytes: number, maxSizeMB: number = 10) {
  // ...
}

// Change max email length
export function validateEmail(email: string) {
  if (trimmed.length > 320) { // Changed from 255
    return { valid: false, error: "Email must be 320 characters or less" };
  }
  // ...
}
```

### Adding Custom Validation

Add new validation functions to `server/utils/validation.ts`:

```typescript
export function validateCustomField(value: string): { valid: boolean; error?: string } {
  // Your validation logic
  if (!value || value.length < 5) {
    return { valid: false, error: "Field must be at least 5 characters" };
  }
  return { valid: true };
}
```

## 🐛 Troubleshooting

### Issue: Validation not working
- **Solution**: Ensure `sanitizeInput` middleware is added to routes
- Check that validation functions are imported correctly

### Issue: Sanitization too aggressive
- **Solution**: Adjust sanitization rules in `server/utils/validation.ts`
- Modify `sanitizeString` function if needed

### Issue: Valid inputs being rejected
- **Solution**: Check validation rules match your requirements
- Review error messages to understand what's being rejected

## 📊 Validation Coverage

### Currently Validated Endpoints

✅ **Authentication**
- `/api/auth/login` - Email, password validation
- `/api/auth/register` - Email, password validation

✅ **Team Members**
- `/api/team-members` (POST) - Email, name validation
- `/api/team-members/:id/privacy` (PATCH) - Time, timezone, UUID validation

✅ **Screenshots**
- `/api/agent/screenshot` (POST) - Base64 image, file size validation

✅ **Reports**
- `/api/reports` (GET) - Date range validation

✅ **Settings**
- `/api/settings` (PUT) - Numeric range validation

### Sanitization Applied To
- All request bodies
- All query parameters
- All route parameters

## 🚀 Production Considerations

1. **Performance**: Sanitization adds minimal overhead but monitor in production
2. **Logging**: Consider logging validation failures for security monitoring
3. **Custom Rules**: Add domain-specific validation as needed
4. **Error Messages**: Keep error messages informative but don't expose system internals

---

## 📄 Summary

This implementation provides:
- ✅ Comprehensive input sanitization
- ✅ Email, date, file, time, and numeric validation
- ✅ Clear, user-friendly error messages
- ✅ Protection against XSS and injection attacks
- ✅ File upload validation (size, type)
- ✅ Automatic whitespace trimming

All inputs are now validated and sanitized before processing, significantly improving the security and reliability of your API.

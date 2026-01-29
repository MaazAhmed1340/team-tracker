## Testing the multi-tenant auth & employee flow

This guide shows how to verify the new company + admin signup and employee-only login behavior, using both the **UI** and **API (curl/Postman)**.

Assumptions:

- Backend runs at `http://localhost:5000`
- Frontend runs at `http://localhost:5173` (or whatever Vite/React dev port you use)
- Environment variables are set (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`)

---

## 1. Start backend and frontend

In one terminal:

```bash
npm run db:push
npm run dev
```

In another terminal (from `client/` if applicable):

```bash
npm run dev
```

Open the app in your browser and confirm you can see the **Sign up** and **Sign in** pages.

---

## 2. Company + admin signup (UI)

1. Go to the **Sign up** page (e.g. `http://localhost:5173/signup`).
2. Fill in:
   - **Company Name:** `Acme Inc`
   - **Email:** `owner@acme.com`
   - **Password:** `StrongPass123!`
   - **Confirm Password:** `StrongPass123!`
3. Submit the form.

Expected:

- Request goes to `POST /api/auth/company-register`.
- A **company** row is created.
- A **user** row is created with `role: "admin"` and `companyId = company.id`.
- A **team_members** row is created for `owner@acme.com` with `role: "admin"`.
- You are logged in and redirected to the dashboard.

If there’s an error, check the backend logs and browser network tab for details.

---

## 3. Company + admin signup (API)

You can also test the combined endpoint directly.

```bash
curl -X POST http://localhost:5000/api/auth/company-register ^
  -H "Content-Type: application/json" ^
  -d "{\"companyName\":\"Acme Inc\",\"companyEmail\":\"owner@acme.com\",\"adminEmail\":\"owner@acme.com\",\"adminPassword\":\"StrongPass123!\"}"
```

Expected JSON (shape):

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "usr_123",
    "email": "owner@acme.com",
    "role": "admin",
    "companyId": "cmp_123"
  },
  "teamMember": {
    "id": "tm_123",
    "name": "owner",
    "email": "owner@acme.com",
    "role": "admin"
  },
  "company": {
    "id": "cmp_123",
    "name": "Acme Inc",
    "email": "owner@acme.com"
  }
}
```

---

## 4. Employee login is blocked until they are added

This verifies: *“Once company adds an employee only then an employee should be able to sign in.”*

1. Make sure **no team member / user exists** for `john.doe@acme.com`.
2. Try to log in via API:

```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"john.doe@acme.com\",\"password\":\"SomePass123!\"}"
```

Expected:

- Response `401` or `403` with an error message, e.g.

```json
{
  "error": "Invalid email or password"
}
```

or

```json
{
  "error": "Your company admin has not added you as an employee yet"
}
```

3. In the UI, the same email/password should not be able to sign in on the **Sign in** page either.

---

## 5. Add an employee as admin

First, log in as the admin (owner) if you aren’t already:

```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -c cookies.txt ^
  -d "{\"email\":\"owner@acme.com\",\"password\":\"StrongPass123!\"}"
```

Copy the `accessToken` from the response.

Then, as admin, create an employee:

```bash
curl -X POST http://localhost:5000/api/team-members ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_ADMIN_LOGIN>" ^
  -d "{\"name\":\"John Doe\",\"email\":\"john.doe@acme.com\",\"role\":\"Developer\",\"password\":\"EmpPass123!\"}"
```

Expected:

- Returns a `member` and a `user` object.
- In the database:
  - New `users` row with `email = john.doe@acme.com`, `companyId` same as admin, and hashed password.
  - New `team_members` row linked via `userId`.

You can verify via your DB inspector or simple `SELECT` queries.

---

## 6. Employee can now log in

Now that the admin has added John as an employee, test login again:

```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"john.doe@acme.com\",\"password\":\"EmpPass123!\"}"
```

Expected:

- `200` with:

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "usr_emp",
    "email": "john.doe@acme.com",
    "role": "viewer",
    "companyId": "cmp_123"
  }
}
```

In the UI, you should now be able to sign in as `john.doe@acme.com` with `EmpPass123!` using the **Sign in** form.

---

## 7. Verify timers and screenshots for employees

Once logged in as an employee (or via the agent process), you can:

- Start a timer:

```bash
curl -X POST http://localhost:5000/api/time-entries/start ^
  -H "Content-Type: application/json" ^
  -d "{\"teamMemberId\":\"<EMPLOYEE_TEAM_MEMBER_ID>\"}"
```

- Upload a screenshot via agent endpoint (requires an agent token and base64 image):

```bash
curl -X POST http://localhost:5000/api/agent/screenshot ^
  -H "Authorization: Bearer <AGENT_TOKEN>" ^
  -H "Content-Type: application/json" ^
  -d "{\"imageData\":\"data:image/png;base64,...\",\"mouseClicks\":10,\"keystrokes\":20,\"activityScore\":80}"
```

In the UI:

- Navigate to the relevant dashboard/team member detail pages and confirm:
  - Employee appears in the team list.
  - Activity (timers, screenshots) is attributed to that employee.

---

## 8. Quick checklist

- [ ] Company + admin can register via `/api/auth/company-register` or Signup UI.
- [ ] First admin can immediately log in and see their dashboard.
- [ ] A random email **cannot** log in until added as an employee.
- [ ] Admin can add an employee via `/api/team-members` (UI or API), providing a password.
- [ ] Newly added employee **can** log in.
- [ ] Employee can have timers and screenshots associated with their team member record.


# Auth Testing Playbook (Emergent Google Auth + Email/Password)

## Test Identities
- Email/password test user: `testuser@example.com` / `Test@1234`
- Google OAuth: use any real Google account; backend session is created on callback.

## Create Test User & Session via Mongo (Google flow only)
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  auth_provider: 'google',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Endpoints
- `POST /api/auth/register` { email, password, name } → { user, token }
- `POST /api/auth/login` { email, password } → { user, token }
- `POST /api/auth/google-session` { session_id } → sets cookie + returns user
- `GET /api/auth/me` → returns current user (cookie OR Authorization: Bearer)
- `POST /api/auth/logout` → clears cookie + deletes session

## Browser Test
```js
await page.context.add_cookies([{
    name: "session_token",
    value: "YOUR_SESSION_TOKEN",
    domain: "mock-interview-ai-32.preview.emergentagent.com",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "None"
}]);
await page.goto("https://mock-interview-ai-32.preview.emergentagent.com/dashboard");
```

## Success
- /api/auth/me returns 200 with user data
- /dashboard loads, history rows filtered to that user
- Logout clears cookie → /dashboard redirects to /login

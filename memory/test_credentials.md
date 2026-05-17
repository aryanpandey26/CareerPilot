# Test Credentials

## Email/Password (JWT)
- Email: `demo@example.com`
- Password: `Demo@1234`
- User ID: `user_9724c5cf51a5`

## Google OAuth
Any real Google account. Backend creates user on first callback at `POST /api/auth/google-session`.

## Endpoints
- `POST /api/auth/register` — public
- `POST /api/auth/login` — public
- `POST /api/auth/google-session` — public (exchanges OAuth session_id for cookie)
- `GET /api/auth/me` — requires cookie OR `Authorization: Bearer <jwt>`
- `POST /api/auth/logout`

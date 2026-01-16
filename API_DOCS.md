# Bato-AI Backend API Documentation

This directory contains the complete API documentation for the Bato-AI learning platform backend.

## 📄 Documentation File

- **`swagger.yaml`** - OpenAPI 3.0 specification with all API endpoints

## 🚀 Viewing the Documentation

### Option 1: Swagger UI (Recommended)

Visit [Swagger Editor](https://editor.swagger.io/) and paste the contents of `swagger.yaml`.

### Option 2: VS Code Extension

1. Install the **Swagger Viewer** extension in VS Code
2. Open `swagger.yaml`
3. Right-click and select "Preview Swagger"

### Option 3: Swagger UI Server (Local)

```bash
# Install swagger-ui-express
npm install swagger-ui-express yamljs

# Add to your app.ts:
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const swaggerDocument = YAML.load('./swagger.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

# Then visit: http://localhost:4000/api-docs
```

### Option 4: Online Swagger UI

1. Go to https://petstore.swagger.io/
2. Enter the URL to your `swagger.yaml` file (if hosted)
3. Or copy-paste the YAML content

## 📚 API Overview

### Authentication

- **Better Auth** (`/api/auth/*`) - OAuth2, email/password signup/signin
- **Custom Auth** (`/auth/*`) - OTP verification, profile access

### Core Features

- **Roadmaps** (`/api/roadmap/*`) - AI-powered learning roadmap generation
- **Chat** (`/api/chats/*`) - Interactive learning assistance
- **Progress** (`/api/roadmap/:id/progress/*`) - Learning progress tracking

## 🔑 Authentication Methods

Most endpoints require authentication via:

1. **Cookie Auth** - Better Auth session cookie (`better-auth.session_token`)
2. **Bearer Token** - JWT token in Authorization header

## 📝 Example Requests

### Sign Up with Email

```bash
curl -X POST http://localhost:4000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "name": "John Doe"
  }'
```

### Verify OTP

```bash
curl -X POST http://localhost:4000/auth/verifyOtp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp": "123456"
  }'
```

### Generate Roadmap (Streaming)

```bash
curl -X POST http://localhost:4000/api/roadmap/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Full Stack Development",
    "techStack": ["React", "Node.js", "PostgreSQL"],
    "difficulty": "intermediate",
    "estimatedDuration": "3 months"
  }'
```

### Get User Roadmaps

```bash
curl -X GET "http://localhost:4000/api/roadmap?limit=10&sortBy=createdAt&order=desc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🏷️ API Tags

- **Better Auth** - OAuth and email authentication
- **Custom Auth** - OTP verification system
- **Roadmap** - AI roadmap generation and management
- **Chat** - Chat sessions for learning
- **Progress** - Progress tracking

## 🔗 Useful Links

- [OpenAPI Specification](https://swagger.io/specification/)
- [Better Auth Documentation](https://www.better-auth.com/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)

## 📊 Response Formats

All responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "errorCode": "ERROR_CODE"
}
```

## 🛠️ Development

To update the documentation:

1. Edit `swagger.yaml`
2. Validate using [Swagger Editor](https://editor.swagger.io/)
3. Test endpoints using the Swagger UI

## 📞 Support

For issues or questions about the API, contact the Bato-AI team.

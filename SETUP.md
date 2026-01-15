# ProgressLog Backend Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL database
- Git

### 1. Database Setup
```bash
# Create PostgreSQL database
createdb progresslog

# Update DATABASE_URL in .env file with your credentials
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# (Optional) View database in Prisma Studio
npm run db:studio
```

### 4. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 📁 Project Structure

```
Progress_Log_BE/
├── src/
│   ├── app.js                 # Main Express server
│   ├── config/
│   │   └── database.js        # Prisma database configuration
│   ├── controllers/           # Route controllers (to be implemented)
│   ├── middleware/
│   │   ├── auth.js           # Authentication middleware
│   │   ├── upload.js         # File upload middleware
│   │   └── validation.js     # Request validation middleware
│   ├── models/               # Data models (to be implemented)
│   ├── routes/               # API routes
│   │   ├── admin.js          # Admin endpoints
│   │   ├── auth.js           # Authentication endpoints
│   │   ├── evidence.js       # Evidence/file endpoints
│   │   ├── health.js         # Health check endpoints
│   │   ├── milestones.js     # Milestone endpoints
│   │   ├── projects.js       # Project endpoints
│   │   ├── public.js         # Public endpoints
│   │   ├── reviews.js        # Review endpoints
│   │   ├── snapshots.js      # Snapshot endpoints
│   │   └── users.js          # User endpoints
│   ├── services/             # Business logic (to be implemented)
│   ├── utils/
│   │   ├── logger.js         # Logging utilities
│   │   └── response.js       # Response utilities
│   └── prisma/               # Prisma utilities
├── prisma/
│   └── schema.prisma         # Database schema
├── uploads/                  # File upload directory
├── logs/                     # Log files (created automatically)
├── .env                      # Environment variables
├── .env.example              # Environment variables template
├── .gitignore               # Git ignore file
├── nodemon.json             # Nodemon configuration
└── package.json             # Dependencies and scripts
```

## 🔧 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with sample data

## 🌐 API Endpoints

### Health Checks
- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/db` - Database health check

### Authentication (Coming Soon)
- `POST /api/v1/auth/signup` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/session` - Validate session
- `POST /api/v1/auth/logout` - User logout

### Projects (Coming Soon)
- `GET /api/v1/projects` - List user projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/:id` - Get project details
- And more...

## 🛡️ Security Features

- JWT-based authentication
- Role-based authorization (Worker/Reviewer)
- File upload validation and size limits
- CORS configuration
- Helmet security headers
- Request validation middleware
- SQL injection prevention (Prisma)

## 📊 Database Schema

The database includes the following main entities:
- **Users** - Workers and reviewers
- **Projects** - Project management
- **Milestones** - Project milestones with approval workflow
- **Evidence** - File attachments for milestones
- **Snapshots** - Immutable project state exports
- **Sessions** - User authentication sessions
- **Notifications** - User notifications

## 🚧 Next Steps

1. **Set up your PostgreSQL database** and update the `.env` file
2. **Run database migrations** to create tables
3. **Implement authentication routes** in `src/routes/auth.js`
4. **Add validation schemas** using Joi or similar
5. **Implement business logic** in services and controllers
6. **Add comprehensive error handling**
7. **Set up file storage** (local or cloud)
8. **Add rate limiting** and security measures
9. **Write tests** for all endpoints
10. **Set up CI/CD** pipeline

## 📝 Environment Variables

Copy `.env.example` to `.env` and update the values:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://username:password@localhost:5432/progresslog"
JWT_SECRET=your-secret-key
```

## 🐛 Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL format
- Verify database exists

### Port Already in Use
- Change PORT in `.env` file
- Kill existing process on port 3000

### File Upload Issues
- Ensure uploads directory exists
- Check file permissions
- Verify file size limits

## 📚 Documentation

See `README.md` for the complete API specification with all 60+ endpoints detailed.

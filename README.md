# Comment Forum Server

A real-time comment forum backend built with NestJS, PostgreSQL, and WebSockets.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v20 or later)
- pnpm
- Docker and Docker Compose
- PostgreSQL (if running locally without Docker)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=commentforum
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h
```

## Installation & Setup

### Option 1: Using Docker (Recommended)

1. Build and start the containers:
```bash
docker compose up --build
```

This will:
- Build the NestJS application
- Start PostgreSQL database
- Set up the network between services
- Expose the API on port 3000

To run in detached mode:
```bash
docker compose up -d
```

To stop the services:
```bash
docker compose down
```

To view logs:
```bash
docker compose logs -f
```

### Option 2: Local Development

1. Install dependencies:
```bash
pnpm install
```

2. Start PostgreSQL (make sure it's running locally)

3. Run the development server:
```bash
# Development with hot-reload
pnpm run start:dev

# Production mode
pnpm run start:prod
```



## API Documentation

Once the server is running, you can access the API documentation at:
- Swagger UI: http://localhost:3000/api


## WebSocket Endpoints

The application uses WebSockets for real-time features:
- Comment threads: `ws://localhost:3000/comments`
- Notifications: `ws://localhost:3000/notifications`

## Project Structure

```
src/
├── modules/           # Feature modules (auth, comments, notifications, users)
├── entities/          # Database entities
├── common/           # Shared decorators, filters, guards, pipes
├── config/           # Configuration files
└── utils/            # Utility functions and helpers
```

## Docker Commands Reference

```bash
# Rebuild a specific service
docker compose build api

# View container logs
docker compose logs -f api
docker compose logs -f postgres

# Access PostgreSQL CLI
docker compose exec postgres psql -U your_username -d commentforum

# Restart services
docker compose restart

# Remove all containers and volumes
docker compose down -v
```


## Acknowledgments

Built with [NestJS](https://nestjs.com/) - A progressive Node.js framework for building efficient and scalable server-side applications.

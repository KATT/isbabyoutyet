# Setup Instructions

## Prerequisites

1. Node.js >= 24.0.0
2. pnpm package manager

## Initial Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Initialize Convex (First Time Only)

On first run, you'll need to initialize Convex. Run:

```bash
npx convex dev
```

This will:

- Create a Convex project (if not already created)
- Generate the `convex/_generated` files
- Set up the Convex dashboard
- Provide a `VITE_CONVEX_URL` that you need to add to your `.env` file

**Note:** After the first initialization, you can skip this step and use `pnpm dev` which runs both Convex and Vite together.

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
VITE_CONVEX_URL=your_convex_url_from_step_2
VITE_BETTER_AUTH_URL=http://localhost:3000
```

### 4. Set Up Better Auth Secret

Generate a secret for better-auth:

```bash
npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
```

Or manually set it in your `.env.local` file (for local development).

### 5. Run the Development Server

```bash
pnpm dev
```

This command runs both Convex and Vite concurrently:

- **Convex**: Backend development server (cyan output)
- **Vite**: Frontend development server (yellow output)

The app will be available at `http://localhost:3000`

You can also run them separately if needed:

- `pnpm dev:convex` - Run only Convex
- `pnpm dev:vite` - Run only Vite

## Features

- **Public Homepage**: Information about the app
- **Authentication**: Sign up and login with email/password
- **Dashboard**: View all your babies
- **Add Baby**: Create a new baby tracking page with name and due date
- **Public Tracking Page**: Shareable link for each baby
- **Status Updates**: Update status as labor progresses (owner only)
- **Real-time Updates**: Changes reflect immediately via Convex

## Routes

- `/` - Public homepage
- `/auth/login` - Login page
- `/auth/signup` - Sign up page
- `/dashboard` - User's babies list (protected)
- `/dashboard/add` - Add new baby (protected)
- `/baby/$publicId` - Public baby tracking page

## Notes

- `pnpm dev` runs both Convex and Vite together - no need to run them separately
- Better-auth handles authentication and integrates with Convex automatically
- All baby tracking pages are public (anyone with the link can view)
- Only the owner can update the status

# Skill Tree Tracker

## Overview

Skill Tree Tracker is a full-stack web application that enables users to visualize and track their skill development across multiple areas of interest. The application presents skills as interconnected nodes in a tree structure, where users can mark skills as mastered, track dependencies, and manage their learning progression across different domains (e.g., Guitar, Football, Literature, Home Management).

The application is built as a modern single-page application with a REST API backend, featuring a rich interactive UI for managing skill trees with visual connections and progression tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server.

**UI Component Library**: The application uses shadcn/ui components (based on Radix UI primitives) with Tailwind CSS for styling. The "new-york" style variant is configured, using CSS variables for theming and a neutral color palette.

**State Management**: 
- React Context API (`SkillTreeContext`) manages global state for areas and skills
- TanStack Query (React Query) handles server state management and caching
- Local state with React hooks for component-level state

**Routing**: Wouter is used for client-side routing, providing a lightweight alternative to React Router.

**Animations**: Framer Motion powers transitions and animations for skill nodes and area switching.

**Form Handling**: React Hook Form with Zod validation for form state management and input validation.

**Design Pattern**: The application follows a component-based architecture with:
- Presentational components in `/components`
- Page components in `/pages`
- Shared utilities and hooks in `/lib` and `/hooks`
- Reusable UI components from shadcn/ui in `/components/ui`

### Backend Architecture

**Framework**: Express.js running on Node.js with TypeScript.

**API Design**: RESTful API with the following endpoints:
- `GET /api/areas` - Retrieve all areas with their skills
- `POST /api/areas` - Create a new area
- `DELETE /api/areas/:id` - Delete an area
- `POST /api/skills` - Create a new skill
- `PUT /api/skills/:id` - Update a skill
- `DELETE /api/skills/:id` - Delete a skill

**Data Validation**: Zod schemas (with drizzle-zod integration) validate incoming requests, ensuring type safety between client and server.

**Static File Serving**: In production, Express serves the built Vite client application. In development, Vite's middleware is integrated into Express for hot module replacement.

**Error Handling**: Centralized error handling with validation errors converted to user-friendly messages using zod-validation-error.

**Development Setup**: Custom Vite integration (`server/vite.ts`) enables HMR during development while maintaining a unified server.

### Data Storage

**ORM**: Drizzle ORM provides type-safe database access with PostgreSQL.

**Database Schema**:
- `areas` table: Stores skill area information (id, name, icon, color, description)
- `skills` table: Stores individual skills with position data, status, dependencies, and flags
  - Foreign key relationship to areas with cascade delete
  - JSONB field for storing skill dependencies as an array
  - Status field tracks progression (locked, available, mastered)
  - Position fields (x, y) for visual layout
  - Manual lock and final node flags for custom progression control

**Storage Layer**: Abstracted through an `IStorage` interface with `DbStorage` implementation, allowing for potential alternate storage backends while maintaining consistent API access patterns.

**Migrations**: Drizzle Kit manages database schema migrations with configuration in `drizzle.config.ts`.

**Connection Pooling**: Node-postgres pool manages database connections efficiently.

### Build and Deployment

**Build Process**: Custom build script (`script/build.ts`) orchestrates:
1. Client build via Vite (outputs to `dist/public`)
2. Server build via esbuild (bundles to `dist/index.cjs`)
3. Strategic bundling of server dependencies to reduce cold start times

**Bundling Strategy**: Select server dependencies are bundled (allowlist) while others remain external to balance bundle size and startup performance.

**Development Workflow**:
- `npm run dev` - Starts development server with Vite HMR
- `npm run dev:client` - Client-only development on port 5000
- `npm run build` - Production build
- `npm run start` - Production server

**Path Aliases**: TypeScript path mapping configured for clean imports:
- `@/*` - Client source files
- `@shared/*` - Shared types and schemas
- `@assets/*` - Attached assets

## External Dependencies

### Core Framework Dependencies
- **React 18**: UI framework with createRoot API
- **Express 4**: Web server framework
- **Vite**: Build tool and development server with plugins for React, Tailwind CSS, and Replit-specific features
- **TypeScript**: Type system across client and server

### Database and Data Layer
- **PostgreSQL**: Primary database (connection string via `DATABASE_URL` environment variable)
- **Drizzle ORM**: Type-safe ORM with PostgreSQL dialect
- **node-postgres (pg)**: PostgreSQL client with connection pooling
- **Drizzle Kit**: Database migration tool
- **Zod**: Runtime type validation and schema definition
- **drizzle-zod**: Bridge between Drizzle schemas and Zod validation

### UI and Styling
- **Radix UI**: Headless UI component primitives (20+ components including Dialog, Dropdown, Popover, etc.)
- **Tailwind CSS**: Utility-first CSS framework with @tailwindcss/vite plugin
- **shadcn/ui**: Component collection built on Radix UI
- **Lucide React**: Icon library
- **class-variance-authority**: Variant-based className management
- **tailwind-merge & clsx**: Utility for merging Tailwind classes

### State and Data Management
- **TanStack Query (React Query)**: Server state management and caching
- **React Hook Form**: Form state management
- **@hookform/resolvers**: Validation resolver for React Hook Form with Zod integration
- **Wouter**: Lightweight client-side routing

### Animation and Interactions
- **Framer Motion**: Animation library for transitions and gestures
- **embla-carousel-react**: Carousel component functionality

### Development Tools
- **esbuild**: Fast JavaScript bundler for server code
- **tsx**: TypeScript execution for development and build scripts
- **date-fns**: Date utility library

### Replit-Specific Integrations
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Replit code navigation (development only)
- **@replit/vite-plugin-dev-banner**: Development environment banner (development only)
- Custom `vite-plugin-meta-images.ts`: Updates OpenGraph meta tags with Replit deployment URLs

### Build Configuration
- **PostCSS**: CSS processing with Tailwind and Autoprefixer
- **Autoprefixer**: Automatic vendor prefixing for CSS
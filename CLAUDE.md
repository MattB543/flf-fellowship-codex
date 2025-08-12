# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Slack message search and summarization application with:
- **Frontend**: Vue 3 + TypeScript + Vite + Naive UI, located in `/web`
- **Backend API**: Provides semantic search and summarization for Slack messages (running on port 3000)
- **Database**: PostgreSQL with vector embeddings for semantic search

## Development Commands

### Frontend (in `/web` directory)
```bash
# Install dependencies
npm install

# Run development server with API proxy to localhost:3000
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check (no tests configured yet)
vue-tsc -b
```

### Node Version
Use Node.js 22.12.0 (specified in `.nvmrc`)

## Architecture

### API Endpoints
The frontend communicates with these backend endpoints:

1. **POST /api/search** - Semantic message search with vector similarity
   - Accepts: query, topK, channels, dateFrom, dateTo, includeThreads
   - Returns: messages with scores and optional thread context

2. **GET /api/links** - Extract links from messages
   - Query params: channel_id, user_id, dateFrom, dateTo, limit, offset, includeThreads
   - Returns: messages containing URLs with optional thread context

3. **GET /api/thread** - Fetch full thread by root timestamp
   - Query params: channel_id, root_ts
   - Returns: all messages in a thread ordered by timestamp

4. **POST /api/summarize** - Summarize messages using GPT
   - Accepts: messageIds array (max 100)
   - Returns: summary text

### Frontend Structure
- **Router**: Two main routes - `/` (SearchView) and `/links` (LinksView)
- **API Client** (`/web/src/api/client.ts`): Handles auth, retries, and error handling
- **Thread Caching** (`/web/src/stores/threadCache.ts`): In-memory cache for thread deduplication
- **Components**:
  - `FiltersBar.vue` - Search input and filters
  - `ResultTable.vue` - Display search results
  - `LinksTable.vue` - Display extracted links
  - `SummaryPanel.vue` - Show summarization results
  - `ThreadPreview.vue` - Display thread context

### Authentication
- Bearer token authentication via `VITE_API_TOKEN` environment variable
- Token is sent as `Authorization: Bearer <token>` header
- Development uses Vite proxy to avoid CORS issues

## Key Implementation Details

### Thread Management
- Threads are identified by `${channel_id}:${thread_root_ts}` keys
- Frontend caches threads to avoid duplicate fetches
- Search includes threads by default (`includeThreads: true`)
- Links view lazy-loads threads on demand

### Text Truncation
- Search results: 300 chars
- Thread messages via search/links: 1000 chars
- Thread messages via /api/thread: 4000 chars

### Performance Considerations
- Search limited to topK=100 max
- Summarization limited to 100 messages
- Eager thread loading for topK ≤ 20, lazy loading for larger result sets
- Exponential backoff retry for network errors

## Environment Configuration

Create `.env` file in `/web`:
```
VITE_API_BASE=          # Leave empty for dev proxy
VITE_API_TOKEN=         # Bearer token from backend
```

## Development Workflow

1. Ensure backend is running on localhost:3000
2. Navigate to `/web` directory
3. Run `npm install` if dependencies not installed
4. Run `npm run dev` to start Vite dev server
5. Access app at http://localhost:5173

## Type Safety

The project uses TypeScript throughout with:
- Strict type checking via `vue-tsc`
- Defined interfaces for all API responses
- Proper error handling with custom ApiError class
# TODO

## Phase 5 - Integrations & Export (Pending)

### Slack Integration
- [ ] Create Slack Bot app
- [ ] OAuth flow for workspace connection
- [ ] Send summary to selected channel
- [ ] Format meeting cards for Slack
- [ ] Handle thread replies
- [ ] Store integration logs

### Email Delivery
- [ ] SendGrid integration
- [ ] Email template design
- [ ] Recipient selection UI
- [ ] Attachment support (PDF)
- [ ] Schedule delivery
- [ ] Delivery status tracking

### Google Calendar Sync (MCP)
- [ ] Wait for MCP server setup
- [ ] Fetch calendar events
- [ ] Create meeting from calendar invite
- [ ] Sync attendees
- [ ] Update calendar with recording link
- [ ] Pre-meeting reminder notifications

### Export Features
- [ ] PDF export service
- [ ] Markdown export
- [ ] DOCX export (Word)
- [ ] JSON export
- [ ] Batch export multiple meetings
- [ ] Export templates

## Phase 6 - Pre-Meeting Intelligence (Pending)

### Attendee Enrichment
- [ ] LinkedIn profile scraping (via Serper API)
- [ ] Company information lookup
- [ ] Bio/role summary
- [ ] Past meeting history with attendee
- [ ] Relationship mapping

### Meeting Context
- [ ] Retrieve past meetings with same attendees
- [ ] Open action items from previous meetings
- [ ] Pending follow-ups
- [ ] Related meeting threads
- [ ] Context summary generation

### Suggested Talking Points
- [ ] Agenda extraction from description
- [ ] Topic suggestion based on history
- [ ] Reminders from previous meetings
- [ ] Client request tracking
- [ ] Pre-meeting brief generation

## Technical Debt & Improvements

### Code Quality
- [ ] Add comprehensive error handling
- [ ] Implement retry logic for API calls
- [ ] Add request validation (Zod schemas)
- [ ] Improve TypeScript types
- [ ] Add JSDoc comments

### Testing
- [ ] Unit tests for services
- [ ] Integration tests for API routes
- [ ] E2E tests for recording flow
- [ ] Load testing for concurrent recordings
- [ ] Accessibility testing

### Performance
- [ ] Optimize embedding generation (batch)
- [ ] Cache frequently accessed meetings
- [ ] Lazy load transcript lines
- [ ] Compress audio before upload
- [ ] Add pagination to meeting lists

### Developer Experience
- [ ] Docker Compose for local dev
- [ ] Database seeding with realistic data
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Postman collection
- [ ] Setup scripts automation

### Security Hardening
- [ ] Rate limiting on API endpoints
- [ ] Input sanitization
- [ ] SQL injection prevention audit
- [ ] CORS policy review
- [ ] Security headers (Helmet.js)

## Infrastructure & DevOps (Future)

### Deployment
- [ ] Dockerfile for backend
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Staging environment
- [ ] Production environment
- [ ] Database migrations automation
- [ ] Health check endpoints

### Monitoring & Observability
- [ ] Application logging (Winston/Pino)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (DataDog/New Relic)
- [ ] API metrics dashboard
- [ ] User analytics

### Electron Desktop
- [ ] Code signing (macOS/Windows)
- [ ] Auto-update mechanism
- [ ] Crash reporting
- [ ] DMG/MSI installers
- [ ] App Store submission

## Feature Enhancements (v2.0)

### Advanced AI
- [ ] Multi-language support (30+ languages)
- [ ] Custom vocabulary training
- [ ] Sentiment analysis
- [ ] Topic modeling
- [ ] Meeting quality scoring

### Collaboration
- [ ] Shared notes with team
- [ ] Comment threads on transcript
- [ ] @mention notifications
- [ ] Team workspaces
- [ ] Permission management

### Customization
- [ ] Custom action item templates
- [ ] Meeting templates
- [ ] Custom AI prompts
- [ ] Branding customization
- [ ] Export templates

---

**Priority Order:**
1. API key configuration & testing
2. Slack integration
3. Email delivery
4. Pre-meeting intelligence
5. Export features
6. Calendar sync (depends on MCP)

See [`docs/completed.md`](completed.md) for what's already done.
See [`docs/in-progress.md`](in-progress.md) for current work.

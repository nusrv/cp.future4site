# CP Content Workflow Polishing Plan

Status: implemented in source; verification pending
Updated: 2026-06-28

## Outcome

Replace the current always-visible action list with a guided content pipeline. Each request shows its current stage, automation progress, preview, and one primary next action. Text, image, video, and carousel requests follow separate paths after copy approval. Nothing enters Publishing until all required content and media are approved.

## Current problems confirmed in code

1. Every request shows Generate, Request revision, Approve internal, Approve publication, and Reject regardless of format or state.
2. The content format changes the creative job type, but not the interface or approval sequence.
3. Approving publication changes the request to `APPROVED_PUBLICATION` immediately, so it appears in Publishing before required media exists.
4. The callback route materializes text-generation results only. Image and video callbacks do not create `CreativeAsset` or `FileObject` records.
5. The client invalidates queries after its own mutations but does not poll while n8n works, so external callbacks are not visible until refresh.
6. Publishing does not display or validate media readiness.
7. Publishing exposes five equal actions instead of guiding channel selection, validation, dry run, and final publication.

## Target information architecture

Rename Marketing Studio to **Content** and organize it as a pipeline:

- Drafts
- Generating copy
- Review copy
- Creating media
- Review media
- Ready to publish
- Published
- Rejected and archived

Keep **Publishing** as a focused execution queue. Only complete, approved posts can enter it.

Each content item opens a detail view with:

- Request summary and selected format
- Compact progress indicator
- Copy preview
- Media preview when applicable
- Automation status and useful errors
- Activity history
- One primary action and up to two relevant secondary actions

## Format-specific paths

### Text only

`Draft -> Generate copy -> Review copy -> Approve and send to Publishing -> Publish`

Copy-review actions:

- Primary: **Approve and send to Publishing**
- Secondary: **Request copy changes**
- Overflow: **Reject request**, **Archive**

Do not offer Instagram when the configured publishing integration requires media.

### Text and image

`Draft -> Generate copy -> Review copy -> Approve copy and create image -> Generating image -> Review image -> Approve image and send to Publishing -> Publish`

Image-review actions:

- Primary: **Approve image and send to Publishing**
- Secondary: **Create another image**
- Secondary: **Request image changes**
- Overflow: **Reject creative**

### Text and video

`Draft -> Generate copy -> Review copy -> Approve copy and create video -> Generating video -> Review video -> Approve video and send to Publishing -> Publish`

Video-review actions:

- Primary: **Approve video and send to Publishing**
- Secondary: **Create another video**
- Secondary: **Request video changes**
- Overflow: **Reject creative**

Video generation must expose expected wait state, progress when available, and a playable preview before approval.

### Carousel

`Draft -> Define slide count and slide copy -> Generate copy -> Review slides -> Create carousel images -> Review complete set -> Approve carousel and send to Publishing -> Publish`

Carousel approval applies to the complete ordered asset set. It cannot enter Publishing with missing or unapproved slides.

## State and action rules

| State | What the operator sees | Primary action |
| --- | --- | --- |
| Draft | Request details, no output | Generate copy |
| Generating copy | Progress and submitted time | None; Cancel in overflow |
| Copy failed | Clear error and retry guidance | Retry copy generation |
| Review copy | Generated copy and evidence warnings | Format-specific approval action |
| Generating media | Copy plus media job progress | None; Cancel in overflow |
| Media failed | Error, retained approved copy | Retry media generation |
| Review media | Image, video, or carousel preview | Approve media and send to Publishing |
| Ready to publish | Final post preview and channel eligibility | Open Publishing |
| Publishing | Execution progress | None |
| Published | Platform links and timestamps | View published post |
| Rejected | Rejection reason and history | Restore to review |

Buttons that cannot work in the current state must not be rendered. Disabled buttons are reserved for short loading states where the action was previously available.

## Backend and data changes

1. Stop using `APPROVED_PUBLICATION` for copy approval on media formats.
2. Represent copy, creative, and publication readiness independently. Prefer explicit status fields or a validated workflow-state service over scattered string checks.
3. Add transitions for:
   - copy generation requested, completed, failed, and revision requested;
   - creative generation queued, running, completed, failed, revision requested, and approved;
   - ready to publish, publishing, partially published, published, and publish failed.
4. Add dedicated endpoints for copy approval, creative generation, creative approval, and publication readiness.
5. Extend the signed automation callback handler for `creative_image_generation` and `creative_video_generation`.
6. On successful creative callback:
   - validate file metadata and ownership;
   - create or update `FileObject`;
   - create a versioned `CreativeAsset` linked to the request;
   - move the request to media review;
   - record an audit event.
7. Enforce publication guards server-side:
   - approved copy is required;
   - required media exists and is approved;
   - carousel assets are complete and ordered;
   - requested channels support the selected format;
   - no active duplicate publishing job exists.

## Automatic updates

Use React Query polling as the first reliable implementation:

- Poll every 2 to 3 seconds only while a visible request has a running automation job.
- Stop polling when the job completes, fails, or is cancelled.
- Refresh the request detail, asset list, and automation state together.
- Show an inline status change and accessible live-region announcement when a callback arrives.
- Preserve user input and scroll position during refresh.

Server-sent events can replace polling later if operating volume justifies the added complexity.

## Publishing redesign

Publishing becomes a three-step checklist inside each ready item:

1. **Review final post**: copy, hashtags, CTA, image/video/carousel, format, and destination preview.
2. **Choose channels**: Facebook and Instagram checkboxes with eligibility explanations. Remember the request's intended channels but allow correction.
3. **Validate and publish**:
   - Primary: **Run publishing check**
   - After a successful check: **Publish to selected channels**
   - Destructive live publication requires a confirmation summary.

Replace the five current buttons with one channel selector and one stage-dependent primary action. Show per-channel results, so partial success is explicit and retrying one failed channel does not duplicate the successful post.

## Visual and interaction polish

- Replace the permanent two-column form-plus-cards layout with a content list and a focused request drawer or detail page.
- Use a compact progress indicator only where stages are sequential.
- Flatten nested cards. Use sections, dividers, and spacing for hierarchy.
- Reduce large radii and wide shadows; use restrained brand color for primary actions and state indicators.
- Keep a sticky action bar in the detail view so the current next action is visible.
- Use skeletons for initial loading and inline progress for automation.
- Add specific empty states that explain how to create the first request or why Publishing is empty.
- Use consistent success, warning, error, waiting, and approval treatments with text and icons, not color alone.
- Use 150 to 200 ms state transitions and honor reduced-motion preferences.
- Meet WCAG 2.2 AA for contrast, focus, labels, keyboard operation, live status messages, and confirmation dialogs.

## Delivery phases

### Phase 1: State contract and safety

- Define the transition table and format/channel rules.
- Add backend guards and tests.
- Separate copy approval from publication approval.
- Prevent media posts from entering Publishing without approved assets.

### Phase 2: Live status and contextual actions

- Add conditional action rendering.
- Add polling for running jobs.
- Add loading, failure, retry, and callback-arrival states.
- Replace generic labels with format-specific labels.

### Phase 3: Image and video lifecycle

- Implement creative callbacks and asset materialization.
- Build image and video review surfaces.
- Add approve, regenerate, revision, and rejection paths.
- Implement carousel only after the single-image path is stable.

### Phase 4: Publishing queue

- Add final post and media preview.
- Add channel selection and compatibility validation.
- Consolidate dry-run actions into **Run publishing check**.
- Add final confirmation, per-channel results, and safe retry.

### Phase 5: Visual polish and hardening

- Simplify layout and component hierarchy.
- Complete responsive and keyboard behavior.
- Add accessible status announcements and reduced motion.
- Test empty, slow, failed, duplicate, stale, and partial-publication states.

## Acceptance scenarios

1. A text-only request reaches Publishing immediately after copy approval and never offers an invalid channel.
2. An image request cannot reach Publishing until an image callback is received and the image is approved.
3. A video request cannot reach Publishing until a playable video is received and approved.
4. A carousel cannot reach Publishing until every required slide is present, ordered, and approved.
5. n8n results appear without manually refreshing the page.
6. At every state, the user sees one clear primary action.
7. Failed automation shows a useful error and safe retry without duplicate jobs.
8. Publishing check failure cannot trigger live publication.
9. Partial platform success is visible and retrying does not duplicate successful posts.
10. Keyboard-only and reduced-motion users can complete the full workflow.

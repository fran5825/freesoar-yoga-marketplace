# Review Checklist

## Product Review

- Does this feature fit V1 scope?
- Does it support the marketplace goal?
- Does it avoid overbuilding?
- Does it preserve future expansion?

## Brand Review

- Does it feel like Free Soar?
- Does it express freedom, growth, wellness, community?
- Does it avoid pure discount marketplace tone?
- Does it avoid generic fitness website feeling?
- Does it preserve low-pressure UX: clear but not pushy, reassuring but not overpromising?
- Does it avoid anxiety-driven CTA, fear-based urgency, forced scarcity, or excessive conversion pressure?

## Marketplace Logic Review

- Are roles clear?
- Are state transitions valid?
- Are permissions correct?
- Are organizer/teacher/member data boundaries protected?
- Are duplicate enrollments prevented?
- Is class capacity respected?
- Is teacher schedule conflict handled?
- 新增或修改通知時，收件人是否帶 target（指向那一堂課、那個系列或那份邀請）？沒帶 target 時連結會依「收件人有哪些身分」猜（`src/domain/notification/link.ts`，團主優先），同一帳號同時是老師／團主／學員就會走錯頁（2026-10-25 驗收踩過）。測試至少要有一個多重身分的帳號。

## Engineering Review

- TypeScript clean?
- Component boundaries clean?
- Business logic kept out of pages?
- Data validation present?
- Error/loading/empty states handled?
- Tests added where needed?

## RWD Review

- Mobile-first?
- Works at 360px width?
- Works on tablet?
- Works on desktop?
- Forms are usable on mobile?
- Calendar remains readable/usable?
- CTA visible on mobile?

## App-readiness Review

- Domain logic not locked into page components?
- API/service boundary clear?
- Auth assumptions documented?
- Notification model reusable?
- Data model suitable for mobile app later?

# FortalReels video validation

Deploy `validate-fortalreel-media` with JWT verification enabled and apply
`FORTALFY_REELS_9_16_SUPABASE.sql` after `FORTALFY_SOCIAL_V1_SUPABASE.sql` and
`FORTALFY_SOCIAL_VIEWS_V1.sql`. For existing projects, also apply
`FORTALFY_REELS_DURATION_180S_V1.sql` and redeploy this function to enable the
180-second limit. The function downloads the uploaded object from the private
`social-media` bucket and reads its container metadata on the server. Only
vertical 9:16 videos up to 180 seconds are sent to the `publish_fortalreel`
database function, which atomically records the trusted validation and creates
the post and media metadata after checking the creator's current approval.

The endpoint requires `storagePath`, `postId`, `caption`, and `visibility` in the
request body. `postId` must match the UUID in the uploaded object's path; reusing
the same ID and path returns the already-published Reel instead of duplicating it.

The function uses the Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` environment variables. Never expose the service-role
key to the web application.

# Photo storage

Local filesystem storage remains the zero-cost default. Public menu photos keep their /api/v1/uploads/:id/:size.webp URLs; private chat photos are available only through the existing authenticated thread route. The API reads both through PhotoStorage. Only validated WebP keys can be accessed.

Optional S3 uses the official AWS SDK v3. Configure STORAGE_PROVIDER=s3, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY. S3_ENDPOINT and S3_FORCE_PATH_STYLE support compatible services; production custom endpoints require HTTPS. S3_PREFIX defaults to mimiz/. Keep the bucket private, block public bucket access, and grant the API only the required object permissions for that prefix. The API proxies public menu images; it never publishes a private chat object URL or sets a public ACL.

Object writes are conditional and immutable. Reads enforce a size limit. Cloud credentials and a live bucket have not been verified: provider contracts use a stubbed S3 transport and real local temporary files.

Run `pnpm --filter @mimiz/api exec tsx scripts/migrate-photos.mts` for a local-only dry run. After configuring and separately verifying the intended S3 destination, add --apply to copy host data/uploads and data/chat. The command refuses symlinks and invalid keys, compares existing object hashes, refuses different destination content, verifies copied hashes and retains every source file. It does not migrate files that exist only in a Docker volume: export that volume to a separate reviewed staging installation first. Do not point the command at production until a backup and rollback plan are approved.

Customer account removal queues only the same customer-authored private photos already covered by the deletion flow. Pending object deletions survive temporary storage outages and retry with backoff. This does not change financial/order-event/audit retention.

Local backup uses the running application's Docker photo volume. If no application container exists, it uses host files. An existing stopped application container is refused to avoid backing up stale host photos; use the documented explicit source override when appropriate. S3 deployments need provider-side versioning/backup and a restore rehearsal; the local backup command is not an S3 export.

References: [AWS PutObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/) and [AWS GetObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/GetObjectCommand/).

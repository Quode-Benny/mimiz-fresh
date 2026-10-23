# Local backup and restore rehearsal

Run `pnpm backup` to create a PostgreSQL custom-format dump, photo archive and SHA256 manifest under ignored data/backups. The script automatically captures public uploads and private chat photos from the running application container, or from native-host data when no application container exists. If an application container exists but is stopped, automatic backup refuses to guess the photo source. Start the container, or explicitly set BACKUP_PHOTO_SOURCE=native only when host files are authoritative. BACKUP_PHOTO_SOURCE=container requires a running application container. The manifest records the source. Production and S3 modes are refused; they require their own backup service.

Run `pnpm verify:restore` to check the manifest/checksums, restore the database into a uniquely named temporary database, query schema/orders/users/PostGIS, validate the photo archive and remove only that temporary database. The working database is never a restore target. This rehearsal validates the archive; it does not overwrite the running application's photo volume.

Both native-host and container-volume backup paths have been exercised locally. Backups contain private records and photos: restrict their access and encrypt off-host copies. Secrets and owner credentials need a separate encrypted backup.

Production still needs scheduling, off-site retention, alerting, an approved recovery target and a complete deployment restore rehearsal.

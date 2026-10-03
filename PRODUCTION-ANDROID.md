# NATIONAL ENTERPRISES: Android client rollout

This guide is for **Android only** and a **new, empty production database**. The phone sends data to a hosted API. Customer, sale, due, and payment records live in PostgreSQL, so installing a newer APK does not replace them.

## 1. Prepare the accounts

Create a Render account, an AWS account with a private S3 bucket, and an Expo account. These are paid production services; review their current pricing before creating resources. Keep the Render, AWS, and Expo ownership in the company's accounts or provide the company with administrator access.

Create the S3 bucket in `ap-southeast-1`. Enable bucket versioning and set a lifecycle rule to retain monthly exports for at least 13 months. Give the backup IAM user only `s3:PutObject` and `s3:GetObject` on `arn:aws:s3:::YOUR_BUCKET/national-enterprises/*`. Keep the access key in Render environment variables, never in Git. The backup script requests S3 managed server-side encryption.

## 2. Host the API and database

Commit and push the reviewed source to GitHub. In Render, create a **Blueprint** from this repository's [render.yaml](render.yaml). It declares a paid PostgreSQL instance in Singapore, an API web service, and a cron job at 03:00 UTC on the first day of every month (08:30 India time). The database blocks public connections; Render services use its internal URL. The paid database also has short-window point-in-time recovery. The monthly S3 export supplies longer retention.

Render will request these secret values:

| Service | Variable | Value |
| --- | --- | --- |
| API | `ADMIN_PASSWORD` | A new unique password, at least 12 characters; record it in a password manager. |
| Backup | `BACKUP_S3_BUCKET` | Private bucket name. |
| Backup | `AWS_DEFAULT_REGION` | `ap-southeast-1`. |
| Backup | `AWS_ACCESS_KEY_ID` | Key for the restricted backup IAM user. |
| Backup | `AWS_SECRET_ACCESS_KEY` | Secret for the same user. |

Render generates the API's `SECRET_KEY` and database connection string. Do not change either during ordinary releases. The Blueprint waits for the repository checks to pass. Before each deploy, Render runs `python -m alembic upgrade head`; it updates schema without dropping application data. The backend starts only after that command succeeds. The first startup seeds exactly A-Line, B-Line, C-Line and the admin user with the password above.

After deployment, check `https://YOUR-API.onrender.com/api/health`, log in through `POST /api/v1/auth/login`, and confirm `GET /api/v1/lines`. The public API URL for the APK is `https://YOUR-API.onrender.com/api/v1`.

## 3. Make a signed client APK

The existing `NATIONAL-ENTERPRISES-debug.apk` is for development and does not connect to the new server automatically. Make a signed internal distribution build from [mobile/eas.json](mobile/eas.json). Keep the same Android package ID and signing key for every later APK.

From `mobile`, after choosing a supported Expo SDK version:

```powershell
npm install --legacy-peer-deps
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest update:configure
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://YOUR-API.onrender.com/api/v1 --environment production --visibility plaintext
npx expo prebuild --platform android
npx eas-cli@latest build --platform android --profile production
```

`update:configure` adds the Expo project ID and updates URL. This repository includes an Android native project, so `prebuild` must also apply the update settings to Android before the signed build. Check `android/app/src/main/AndroidManifest.xml` afterward: `expo.modules.updates.ENABLED` must be `true`, and the updates URL and runtime version must be present. Test the APK on your own phone with the hosted HTTPS API before sending the EAS install link to the client. The client installs from that link, signs in with the new admin password, and chooses A/B/C line. If their phone already has the old debug APK, it may need to be removed once because the debug and release signing keys differ; the production database is on the server.

Expo SDK 52 was specified for the development build, but it is old for a new client release. Check Expo's supported build images and upgrade before delivery if the SDK 52 build cannot be produced or maintained. Do not publish a fresh client build on an SDK with unresolved security or compatibility issues.

## 4. Change the app later

- **API logic:** Run tests, add an Alembic migration when the database schema changes, and deploy the backend. The PostgreSQL database remains the same resource. Keep migrations compatible with APKs that clients have not yet updated.
- **JavaScript, layout, or assets:** Test first, then run `npx eas-cli@latest update --channel production --environment production --message "Describe the fix"`. Compatible signed builds download the update when opened. This works only after the first EAS Update-enabled signed build is installed.
- **Native module, permissions, or SDK change:** Increase the app version/runtime version, create a new signed APK using the same Expo project and signing key, and give the client its new install link. Existing server data remains available after sign-in.

Use a preview build/channel to check an update on your phone before sending it to the production channel. Do not edit an existing migration after deployment; add a new revision.

## 5. Back up and prove restore

The monthly job in [deploy/monthly_backup.py](deploy/monthly_backup.py) uses `pg_dump` to create a PostgreSQL custom-format archive, uploads it to the private S3 bucket with server-side encryption, and checks the uploaded size. It exits with an error if dumping, uploading, or checking fails. Render shows each cron run's status.

After creating the Blueprint, **Trigger Run** for the backup cron once. Confirm an object appears under `national-enterprises/YYYY/MM/` in S3 and record its SHA-256 from the Render job log. Do not wait until next month to test it. Then download one backup and restore it into a **new empty test database** with the same PostgreSQL major version:

```powershell
aws s3 cp s3://YOUR_BUCKET/national-enterprises/YYYY/MM/ARCHIVE.dump .\restore-test.dump
pg_restore --dbname=YOUR_EMPTY_TEST_DATABASE_URL --no-owner --no-acl .\restore-test.dump
```

Verify the restored line names, customer count, sale count, payment count, and total balances against the source database. Never test a restore into the live database. If a recent mistake needs recovery, use Render's point-in-time recovery to create a separate database and verify it before switching the API connection.

Monthly exports limit potential data loss to a month if they are the only recoverable copies. The managed database's point-in-time recovery covers recent days; consider more frequent off-site exports once real collections begin.

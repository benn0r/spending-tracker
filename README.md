# Spending Tracker

> [!IMPORTANT]
> **This entire repository, including the application, design, tests, documentation, and deployment setup was made with AI.**

A calm, mobile-first Expo application for reviewing daily spending and quickly capturing new expenses through Spending Tracker Server.

## Screenshot

<img src="docs/screenshots/home.png" alt="Spending Tracker home screen with fantasy transactions" width="360" />

## Features

- A scannable home screen backed by the server API with balance, income, spending, and all recent transactions.
- A prominent floating add button opens a native-style bottom drawer.
- Transaction and split-transaction modes.
- Server-provided account, category, and tag selections with validated normal and split submissions.
- Server-managed category icons and colors throughout the picker and transaction list.
- Bottom-tab navigation for Transactions, Wallets, Receipts, and Settings.
- Native receipt camera capture, background upload and processing status, with extracted values prefilled into the transaction drawer.
- Persistent default-account selection that prefills new transactions on the current device.
- Persistent failed-transaction queue with visible server errors and individual retry actions.
- Responsive Expo app for Android, iOS, and web.

## Development

```sh
cp .env.example .env
npm ci
npm start
```

Set `EXPO_PUBLIC_SPENDING_TRACKER_API_URL` to the Spending Tracker Server origin reachable from the device. Physical devices cannot use the development computer's `localhost`; use its LAN address or a deployed HTTPS endpoint. Set `EXPO_PUBLIC_SPENDING_TRACKER_API_KEY` when the server requires bearer authentication. Like every Expo public variable, this value is embedded in the client, so use a dedicated mobile API key and rotate it when needed.

Run the full local verification suite:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
```

## Android APK

The Gitea pipeline builds a signed release APK with Gradle after the unit and browser E2E jobs pass on `main` or a semantic `v*` tag. The artifact is named `spending-tracker-android-<commit-or-tag>` and remains available from the workflow run for 30 days.

Configure `EXPO_PUBLIC_SPENDING_TRACKER_API_URL` and, when bearer authentication is required, `EXPO_PUBLIC_SPENDING_TRACKER_API_KEY` as Gitea Actions variables. Expo embeds both public values in the APK, so use a dedicated client key and rotate it when needed.

Use an existing Android release keystore or create an app-specific one with `keytool -genkeypair`. Back it up securely, then add these Gitea Actions secrets without committing the keystore or credentials:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

On macOS, encode the keystore as one line with `base64 -i keystore.jks | tr -d '\n'`.

## Pipeline

Like the Fashion Canvas app, the Gitea pipeline performs uncached installs in separate quality, web-build, unit-test, browser-E2E, and signed Android APK jobs. Unit and browser tests run in parallel after the build gate; the APK runs only after both pass. The app pipeline does not publish a container image.

## License

Spending Tracker is available under the [MIT License](LICENSE).

// ============================================================
//  server.js — Render deployment server
//  Serves static files + Web Push endpoint
// ============================================================

const express  = require('express');
const webpush  = require('web-push');
const admin    = require('firebase-admin');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// ── Serve all static files from this folder ──────────────────
app.use(express.static(path.join(__dirname)));

// ── VAPID config ─────────────────────────────────────────────
const VAPID_PUBLIC_KEY  = 'BJy5wDtsS0uxRHvsCgimGwSR4WGGkEl1qKXCQGsTRhqKq8t8_1BbXfnHwvBWVQHIBTDrJmqNr1dHU-0HIyAmY3I';
const VAPID_PRIVATE_KEY = 'amEQt9xmMyCyLzaZ8Xt5PXPcwcTGUotq0NAnJ8lEmWQ';
const VAPID_EMAIL       = 'mailto:admin@educhat.app';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ── Firebase Admin init ───────────────────────────────────────
const serviceAccount = {
  type: "service_account",
  project_id: "chat-app-a0f95",
  private_key_id: "b5771315f5938308dfd97f1c7136a8235d36be4f",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDjcx7CbjflZEp8\nIOUrCGeVZFyFqG6Z3pc4FL6/838+kYtrY+cYmBUYOwZdZb2NogjlPA9eTf1yDCOt\nmzYV7NhH+yi7zsILuV4nJ/AaWdV7iULYrwTu3bOY/tazkAdBIfDcHk6XX3i3AfFY\nMVfpzhOtEPpkqSWK6XwWnVWBznvPEn788K0EIZnIGV0eZaN1HZqdkbgFGtGMuqZy\n59MlBx7rHhFbdMHY7tJaNHTzGlFB/Y5Fn+oHV5ihxELQraIT9MuGQZT7IV2rKrvM\nlWFvxFsRKHgJ794vOjDLGpZb+cmI8vRA0ZH/PRtn+QdfXymcsgMhsPaChqS/xpnz\nckCYcNOPAgMBAAECggEAZKucbrQ3+0kTirNIm25h4oaESQhOw734snLEJtOQe1IS\nIlsaexE9LPdbDtWsO1b/lu6pYrUkO2lSFVIAc13cMKfi1JVj36qRGMWdiRw/2Cjd\ntGhqx4rLJimNP/a8r0BlihfD803ncSDkAIP+hFaY8N315b3UBxLmwF+s7AJHXFPe\nys1WP2TdJNBuzKkX4NhSX/nmqKt/Lmkbk0QWotJfv0I7Bn+WkaY2PY+whzsAcN48\nny2s0qTOg2tjrNtvMpgAZQk5/z+kxzLUgoDxd8hL6LEEtiOSLEkNEZIa0n07zTz5\nJfcTBNCc/8oQlbBQJ2JCEEQYQ0Celw4KYTiI/L2w0QKBgQD1qZUgqwPqPmuxEzIT\nK2cQXvSk1ngD88B1xv5Fl9ppFDEe0xoqfRZdH2XABqGQQrMlKYEXz/YANJvuoRjD\nWVMo9KkzpCSuwJuB6+gjW0Zo9Yk3Z3n5KreKmraSpjD3bwKqZpVLjNb7gDLDBm/q\nqL/qeYvktbAzGUKUSKodnwLASQKBgQDtBVblk2p65ZTkwVwaXx8wubDh6dcT3d3D\nccOsyRlyuabYI1mVpQBt7JsPMzP64nFus5bNn9DtWg0gwfxtbXW4PCIDTyc4wy8K\nPmPnOOqtllBwBqLCrdVkvicG8ZyaRG9oLWMN67nIY3r3AxlcxJow2gHZ7pQT8dOb\nNA29vC8lFwKBgQDswZAYmNjAE4KEeOSEtwqwK2OJzayC2pM8rxh1h8EWDkC83WTV\nWBKKkuzkIT/qIW43vYVNpr4GOq2hUJ7l/ht4WDsNqv8zcCsvDmV+VcRI+YJR5CcY\nbQPQ0ARu1z5P6Svff9gYpNa4Mjg53uVTeWjkmFmrhTMYPBr/f/x7abkkCQKBgGyt\nwBRwLajAUC87weGNsB2FZ2eO80F2v9J3/YLiirqiCbCdNNx61eGRVd/4WGM3JU/f\nJMyP9Rp/6fkVOYtrX0jkuavOxWsvhAgsZ16EKIcDn0peoI6namtRDVAPxQCvVG3u\nMbcWWQ9bHezZDO4Ob6zqqWKmFFu4zJAjpBFVkkBtAoGBALJbOL6N5MOtc3b9aDYh\nVoJMpuNmukFNLJXg98OoeZYAj/ZsUD5LhB41PhFnffD2OhQ2tiV0vn13OZmsT1p/\nuScUZTNo2QiPGiFj+RDMbZqb65A5yyQrsG3bTZKMFq0d0cBpIdM/dxhomQ64owGi\nkP08jtuKt2YxLdtbvJbK3kmf\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@chat-app-a0f95.iam.gserviceaccount.com",
  client_id: "108972067024781540844",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40chat-app-a0f95.iam.gserviceaccount.com"
};

let db = null;
try {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    console.log('✅ Firebase Admin initialized');
} catch (err) {
    console.error('Firebase Admin init error:', err.message);
}

// ── POST /send-push — send Web Push to a user ────────────────
// Called by Firestore trigger (or you can call it directly)
app.post('/send-push', async (req, res) => {
    const { uid, title, body, icon, chatId, isGroup, type } = req.body;

    if (!uid || !db) {
        return res.status(400).json({ error: 'Missing uid or db not ready' });
    }

    try {
        // Load all push subscriptions for this user
        const subsSnap = await db
            .collection('users')
            .doc(uid)
            .collection('pushSubscriptions')
            .get();

        if (subsSnap.empty) {
            return res.json({ sent: 0, message: 'No subscriptions for this user' });
        }

        const payload = JSON.stringify({ title, body, icon, chatId, isGroup, type });
        const options  = { TTL: 86400 };

        let sent = 0;
        await Promise.allSettled(
            subsSnap.docs.map(async (subDoc) => {
                const sub = subDoc.data();
                try {
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: sub.keys },
                        payload,
                        options
                    );
                    sent++;
                } catch (err) {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await subDoc.ref.delete(); // remove expired subscription
                    }
                }
            })
        );

        res.json({ sent, total: subsSnap.size });
    } catch (err) {
        console.error('/send-push error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ── SPA fallback — serve chat.html for all unknown routes ────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

app.listen(PORT, () => {
    console.log(`✅ EduChat server running on port ${PORT}`);
});

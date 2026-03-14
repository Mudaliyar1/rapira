/**
 * Pure Mongoose Session Middleware
 * Replaces express-session + connect-mongo entirely.
 * Sessions are stored in the MongoDB 'sessions' collection via Mongoose.
 */

const crypto = require('crypto');
const Session = require('../models/Session');

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const SESSION_TTL_SEC = 14 * 24 * 60 * 60;
const COOKIE_NAME = 'rapira.sid';

function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

function getCookieOptions(isProduction) {
    return {
        httpOnly: true,
        maxAge: SESSION_TTL_MS,
        sameSite: 'lax',
        secure: isProduction
    };
}

function canMutateHeaders(res) {
    return !res.headersSent && !res.writableEnded;
}

module.exports = function mongooseSession() {
    const isProduction = process.env.NODE_ENV === 'production';

    return async function sessionMiddleware(req, res, next) {
        // ── 1. Read session ID from cookie ──────────────────────────────────────
        let sessionId = req.cookies ? req.cookies[COOKIE_NAME] : null;
        let sessionDoc = null;

        if (sessionId) {
            try {
                sessionDoc = await Session.findById(sessionId).lean();
                // If expired (belt-and-suspenders, TTL index handles it too)
                if (sessionDoc && sessionDoc.expiresAt < new Date()) {
                    await Session.deleteOne({ _id: sessionId });
                    sessionDoc = null;
                    sessionId = null;
                }
            } catch (err) {
                console.error('[mongooseSession] Error loading session:', err.message);
                sessionDoc = null;
                sessionId = null;
            }
        }

        // ── 2. Prepare initial session data ────────────────────────────────────
        if (!sessionId) {
            sessionId = generateSessionId();
        }

        const initialData = (sessionDoc && sessionDoc.data) ? sessionDoc.data : {};

        // ── 3. Build req.session ────────────────────────────────────────────────
        // Start with data from DB, add session control methods
        req.session = Object.assign({}, initialData);

        // express-session compatibility shim — auth.js and other code may read these
        req.session.id = sessionId;
        req.sessionID = sessionId;
        req.session.cookie = {
            maxAge: SESSION_TTL_MS,
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax'
        };

        // Internal: collect only real session data (exclude shims and control methods)
        const SKIP_KEYS = new Set(['id', 'cookie', 'save', 'destroy', 'regenerate']);
        const _getSessionData = () => {
            const obj = {};
            for (const key of Object.keys(req.session)) {
                if (!SKIP_KEYS.has(key) && typeof req.session[key] !== 'function') {
                    obj[key] = req.session[key];
                }
            }
            return obj;
        };

        // Persist session to MongoDB immediately (used by auth routes etc.)
        req.session.save = async function (cb) {
            try {
                const data = _getSessionData();
                const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
                await Session.findByIdAndUpdate(
                    sessionId,
                    { _id: sessionId, data, expiresAt },
                    { upsert: true, new: true }
                );
                if (canMutateHeaders(res)) {
                    res.cookie(COOKIE_NAME, sessionId, getCookieOptions(isProduction));
                }
                if (cb) cb(null);
            } catch (err) {
                console.error('[mongooseSession] Error saving session:', err.message);
                if (cb) cb(err);
            }
        };

        // Destroy session (used on logout)
        req.session.destroy = async function (cb) {
            try {
                await Session.deleteOne({ _id: sessionId });
                if (canMutateHeaders(res)) {
                    res.clearCookie(COOKIE_NAME);
                }
                req.session = {};
                if (cb) cb(null);
            } catch (err) {
                console.error('[mongooseSession] Error destroying session:', err.message);
                if (cb) cb(err);
            }
        };

        // Regenerate session ID (security: call after login)
        req.session.regenerate = async function (cb) {
            try {
                await Session.deleteOne({ _id: sessionId });
                sessionId = generateSessionId();
                if (cb) cb(null);
            } catch (err) {
                if (cb) cb(err);
            }
        };

        // ── 4. Auto-save session at the END of every response ──────────────────
        const _originalEnd = res.end.bind(res);

        res.end = async function (...args) {
            try {
                // Only save if there is meaningful data (skip empty sessions)
                const data = _getSessionData();
                const hasData = Object.keys(data).length > 0;

                if (hasData) {
                    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
                    await Session.findByIdAndUpdate(
                        sessionId,
                        { _id: sessionId, data, expiresAt },
                        { upsert: true, new: true }
                    );
                    if (canMutateHeaders(res)) {
                        res.cookie(COOKIE_NAME, sessionId, getCookieOptions(isProduction));
                    }
                }
            } catch (err) {
                console.error('[mongooseSession] Error auto-saving session:', err.message);
            }
            _originalEnd(...args);
        };

        next();
    };
};

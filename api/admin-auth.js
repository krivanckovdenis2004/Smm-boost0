import { db, handleCors, verifySession } from './_lib/shared.js';

// Secure admin authentication endpoint
// Checks session token AND admin role from Firestore user document
export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = String(req.body?.userId || '').trim();
    const sessionToken = String(req.body?.sessionToken || '').trim();

    const session = await verifySession(db, userId, sessionToken);
    if (!session.ok) {
      return res.status(session.status).json({ error: session.error });
    }

    // Check admin role
    const user = session.user;
    const isAdmin = user.isAdmin === true || user.role === 'admin';

    if (!isAdmin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    return res.status(200).json({
      ok: true,
      admin: true,
      username: user.username || user.displayName || 'Admin'
    });
  } catch (e) {
    console.error('Admin auth error:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

export default async function handler(req, res) {
  return res.status(403).json({
    error: 'Direct JAP order endpoint is disabled for security. Orders are created only after confirmed payment webhook.'
  });
}

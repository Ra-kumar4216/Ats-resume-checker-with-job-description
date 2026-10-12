function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function methodNotAllowed(res, allowed = 'POST') {
  res.setHeader('Allow', allowed);
  return sendJson(res, 405, { error: 'Method not allowed.' });
}

module.exports = { sendJson, methodNotAllowed };

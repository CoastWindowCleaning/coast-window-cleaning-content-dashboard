// Vercel serverless entrypoint. Vercel maps api/index.js to the /api route
// and (per vercel.json's rewrite) forwards every /api/* request here, where
// the same Express app used for local dev (server/server.js) handles routing
// internally. server.js detects process.env.VERCEL (set automatically by
// Vercel's runtime) and skips app.listen()/the local cron scheduler in that
// case -- see the bottom of that file.
module.exports = require('../server/server.js');

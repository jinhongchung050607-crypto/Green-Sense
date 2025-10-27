const serverless = require('serverless-http');
const app = require('../../app');

// Export the serverless handler
exports.handler = serverless(app);

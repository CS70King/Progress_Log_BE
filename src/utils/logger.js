const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a write stream for access logs
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' }
);

// Custom morgan format
const morganFormat = ':method :url :status :res[content-length] - :response-time ms :date[web]';

// Morgan middleware for logging HTTP requests
const httpLogger = morgan(morganFormat, {
  stream: accessLogStream
});

// Console logger for development
const consoleLogger = morgan(morganFormat);

// Custom error logger
const logError = (error, context = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: 'ERROR',
    message: error.message,
    stack: error.stack,
    context
  };
  
  console.error(JSON.stringify(logEntry, null, 2));
  
  // Also write to error log file
  const errorLogStream = fs.createWriteStream(
    path.join(logsDir, 'error.log'),
    { flags: 'a' }
  );
  errorLogStream.write(JSON.stringify(logEntry) + '\n');
  errorLogStream.end();
};

// Custom info logger
const logInfo = (message, context = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: 'INFO',
    message,
    context
  };
  
  console.log(JSON.stringify(logEntry, null, 2));
  
  // Also write to info log file
  const infoLogStream = fs.createWriteStream(
    path.join(logsDir, 'info.log'),
    { flags: 'a' }
  );
  infoLogStream.write(JSON.stringify(logEntry) + '\n');
  infoLogStream.end();
};

module.exports = {
  httpLogger,
  consoleLogger,
  logError,
  logInfo
};

export const logger = {
  info(message, meta = {}) {
    log('INFO', message, meta);
  },
  warn(message, meta = {}) {
    log('WARN', message, meta);
  },
  error(message, error = null, meta = {}) {
    const errorMeta = error ? { 
      errorMessage: error.message, 
      errorStack: error.stack,
      ...meta 
    } : meta;
    log('ERROR', message, errorMeta);
  }
};

function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    // Structured JSON logging format for log aggregation systems (Finding 7)
    console.log(JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    }));
  } else {
    // Pretty print format for local console readability
    const metaString = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
    const color = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(`${color}[${timestamp}] [${level}]${reset} ${message}${metaString}`);
  }
}
export default logger;

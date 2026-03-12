/** Strip extension and remove chars not allowed by Bedrock Converse document name field. */
function sanitizeFileName(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, '');
  return stem
    .replace(/[^a-zA-Z0-9\s\-\(\)\[\]]/g, '_')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = { sanitizeFileName };

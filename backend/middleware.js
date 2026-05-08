// Validation middleware
export const validateText = (req, res, next) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text field is required" });
  }

  if (typeof text !== "string") {
    return res.status(400).json({ error: "Text must be a string" });
  }

  if (text.trim().length === 0) {
    return res.status(400).json({ error: "Text cannot be empty" });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: "Text cannot exceed 5000 characters" });
  }

  next();
};

export const validateComparison = (req, res, next) => {
  const { text1, text2 } = req.body;

  if (!text1 || !text2) {
    return res.status(400).json({ error: "Both text1 and text2 are required" });
  }

  if (typeof text1 !== "string" || typeof text2 !== "string") {
    return res.status(400).json({ error: "Both texts must be strings" });
  }

  if (text1.trim().length === 0 || text2.trim().length === 0) {
    return res.status(400).json({ error: "Texts cannot be empty" });
  }

  next();
};

// Strip characters that could affect MongoDB queries or prompt injection
function sanitizeString(str) {
  return str
    .trim()
    .slice(0, 200)
    .replace(/[${}]/g, ""); // strip MongoDB operators and template literals
}

export const sanitizeKeyword = (req, res, next) => {
  // sanitize body fields
  for (const field of ["keyword", "query", "forum"]) {
    if (req.body?.[field] !== undefined) {
        if (typeof req.body[field] !== "string") {
        return res.status(400).json({ error: `${field} must be a string` });
      }
      req.body[field] = sanitizeString(req.body[field]);
      if (!req.body[field]) {
        return res.status(400).json({ error: `${field} cannot be empty` });
      }
    }
  }

  // sanitize query params
  for (const field of ["keyword", "query"]) {
if (req.query?.[field] !== undefined) {
        if (typeof req.query[field] !== "string") {
        return res.status(400).json({ error: `${field} must be a string` });
      }
      req.query[field] = sanitizeString(req.query[field]);
    }
  }

  next();
};
const multer = require("multer");

const storage = multer.memoryStorage();

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
  return cb(new Error("Unsupported file type"), false);
};

const uploadMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

function multerErrorHandler(err, req, res, next) {
  const isMulterErr = err instanceof multer.MulterError;
  const isUnsupported = err?.message === "Unsupported file type";
  if (isMulterErr || isUnsupported) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
}
module.exports = { uploadMedia, multerErrorHandler };

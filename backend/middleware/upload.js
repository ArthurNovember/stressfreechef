// middleware/upload.js
const multer = require("multer");
// In-memory storage (nic se neukládá na disk)
const storage = multer.memoryStorage();
// Povolené typy: obrázky + videa
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
];
// Filtr typů souborů
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
  return cb(new Error("Unsupported file type"), false);
};
// Hlavní Multer middleware (limit 5 MB)
const uploadMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
// Převod Multer chyb na 400 (lepší UX pro FE)
function multerErrorHandler(err, req, res, next) {
  const isMulterErr = err instanceof multer.MulterError;
  const isUnsupported = err?.message === "Unsupported file type";
  if (isMulterErr || isUnsupported) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
}
module.exports = { uploadMedia, multerErrorHandler };

// routes/uploadRoutes.js
const express = require("express");
const cloudinary = require("../utils/cloudinary");
const { uploadMedia, multerErrorHandler } = require("../middleware/upload");
const authenticateToken = require("../middleware/authenticateToken");
const mongoose = require("mongoose");

const UserRecipe = require("../models/UserRecipe");

const router = express.Router();

// 📤 Upload obrázku nebo videa k receptu
router.post(
  "/recipe-media",
  authenticateToken,
  uploadMedia.single("file"),
  async (req, res) => {
    try {
      const { recipeId } = req.body;
      if (!recipeId) return res.status(400).json({ error: "Missing recipeId" });
      if (!req.file) return res.status(400).json({ error: "Missing file" });

      // najdeme recept
      const recipe = await UserRecipe.findById(recipeId);
      if (!recipe) return res.status(404).json({ error: "Recipe not found" });
      if (String(recipe.owner) !== String(req.user._id)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const folder = process.env.CLOUDINARY_FOLDER || "stressfreechef/recipes";

      // nahraj do Cloudinary
      const uploadToCloudinary = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder,
              resource_type: "auto", // 👈 auto = obrázek nebo video
              transformation: [{ quality: "auto", fetch_format: "auto" }],
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

      const result = await uploadToCloudinary();

      // smaž starý soubor, pokud už existuje
      if (recipe.image?.publicId) {
        try {
          await cloudinary.uploader.destroy(recipe.image.publicId, {
            resource_type: "auto",
          });
        } catch {}
      }

      // ulož metadata do DB
      recipe.image = {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
      };
      await recipe.save();

      return res.json({ ok: true, image: recipe.image });
    } catch (err) {
      console.error("UPLOAD ERROR >>>", err);
      return res.status(500).json({ error: err.message || "Upload failed" });
    }
  },
  multerErrorHandler // 👈 tady chytáme Multer chyby (400 místo 500)
);

// ❌ Smazání obrázku/videa
router.delete(
  "/recipe-media/:recipeId",
  authenticateToken,
  async (req, res) => {
    try {
      const { recipeId } = req.params;
      const recipe = await UserRecipe.findById(recipeId);
      if (!recipe) return res.status(404).json({ error: "Recipe not found" });
      if (String(recipe.owner) !== String(req.user._id)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (recipe.image?.publicId) {
        try {
          await cloudinary.uploader.destroy(recipe.image.publicId, {
            resource_type: "auto",
          });
        } catch {}
      }

      recipe.image = undefined;
      await recipe.save();

      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Delete failed" });
    }
  }
);

// 📤 Upload media pro konkrétní step (image/video)
router.post(
  "/recipe-step-media",
  authenticateToken,
  uploadMedia.single("file"),
  async (req, res) => {
    try {
      // --- validace vstupu
      const recipeId = String(req.body.recipeId || "").trim();
      const stepIndex = Number(req.body.stepIndex);

      if (!mongoose.Types.ObjectId.isValid(recipeId)) {
        return res.status(400).json({ error: "Invalid recipeId" });
      }
      if (!Number.isInteger(stepIndex) || stepIndex < 0) {
        return res.status(400).json({ error: "Invalid stepIndex" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "Missing file" });
      }

      // --- načti recept a ověř vlastnictví
      const recipe = await UserRecipe.findById(recipeId);
      if (!recipe) return res.status(404).json({ error: "Recipe not found" });
      if (String(recipe.owner) !== String(req.user._id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (stepIndex >= recipe.steps.length) {
        return res.status(400).json({ error: "Step index out of range" });
      }

      // --- složka v Cloudinary (podsložka /steps)
      const folderBase =
        process.env.CLOUDINARY_FOLDER || "stressfreechef/recipes";
      const folder = `${folderBase}/steps`;

      // --- upload do Cloudinary (stream z paměti)
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "auto", // image / video
            transformation: [{ quality: "auto", fetch_format: "auto" }],
          },
          (error, data) => (error ? reject(error) : resolve(data))
        );
        stream.end(req.file.buffer);
      });

      // --- případně smaž staré médium ve stepu (pokud máš uložené publicId)
      const step = recipe.steps[stepIndex];
      if (step.mediaPublicId) {
        try {
          await cloudinary.uploader.destroy(step.mediaPublicId, {
            resource_type: "auto",
          });
        } catch {}
      }

      // --- ulož nová metadata do stepu
      const isVideo = result.resource_type === "video";
      step.type = isVideo ? "video" : "image";
      step.src = result.secure_url;

      // volitelné meta – pokud sis rozšířil stepSchema
      step.mediaPublicId = result.public_id;
      step.mediaWidth = result.width;
      step.mediaHeight = result.height;
      step.mediaFormat = result.format;

      await recipe.save();

      return res.json({
        ok: true,
        stepIndex,
        step: {
          type: step.type,
          src: step.src,
          mediaPublicId: step.mediaPublicId,
          mediaWidth: step.mediaWidth,
          mediaHeight: step.mediaHeight,
          mediaFormat: step.mediaFormat,
        },
      });
    } catch (err) {
      console.error("STEP UPLOAD ERROR >>>", err?.message || err);
      return res.status(500).json({ error: "Upload failed" });
    }
  },
  multerErrorHandler
);

// 🗑️ Smazání média u konkrétního stepu (odolná verze)
router.delete(
  "/recipe-step-media/:recipeId/:stepIndex",
  authenticateToken,
  async (req, res) => {
    try {
      const recipeId = String(req.params.recipeId || "").trim();
      const stepIndexRaw = req.params.stepIndex;
      const stepIndex = Number(stepIndexRaw);

      // 1) validace vstupů
      if (!mongoose.Types.ObjectId.isValid(recipeId)) {
        return res.status(400).json({ error: "Invalid recipeId" });
      }
      if (!Number.isInteger(stepIndex) || stepIndex < 0) {
        return res.status(400).json({ error: "Invalid stepIndex" });
      }

      // 2) načti recept + autorizace
      const recipe = await UserRecipe.findById(recipeId);
      if (!recipe) return res.status(404).json({ error: "Recipe not found" });
      if (String(recipe.owner) !== String(req.user._id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!Array.isArray(recipe.steps) || stepIndex >= recipe.steps.length) {
        return res.status(400).json({ error: "Step index out of range" });
      }

      const step = recipe.steps[stepIndex];

      // 3) smaž asset v Cloudinary (publicId je volitelné)
      const publicId = step?.mediaPublicId;
      if (publicId) {
        try {
          // auto by mělo stačit, ale pro jistotu fallback
          await cloudinary.uploader.destroy(publicId, {
            resource_type: "auto",
          });
        } catch (errAuto) {
          try {
            await cloudinary.uploader.destroy(publicId, {
              resource_type: "image",
            });
          } catch (errImg) {
            try {
              await cloudinary.uploader.destroy(publicId, {
                resource_type: "video",
              });
            } catch (errVid) {
              console.warn(
                "Cloudinary destroy failed:",
                errAuto?.message || errAuto,
                "|",
                errImg?.message || errImg,
                "|",
                errVid?.message || errVid
              );
              // nepadáme – DB stejně uklidíme
            }
          }
        }
      }

      // 4) vyčisti metadata stepu v DB
      step.type = "text"; // 👈 přidej toto
      step.src = undefined; // nebo "" – ale undefined je lepší
      step.mediaPublicId = undefined;
      step.mediaWidth = undefined;
      step.mediaHeight = undefined;
      step.mediaFormat = undefined;

      await recipe.save();

      return res.json({ ok: true });
    } catch (err) {
      console.error("STEP DELETE ERROR >>>", err?.message || err);
      return res.status(500).json({ error: "Delete failed" });
    }
  }
);

module.exports = router;

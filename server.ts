import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dlnyyzwvx", // We can default or let them override
  api_key: process.env.CLOUDINARY_API_KEY || "633679995456178",
  api_secret: process.env.CLOUDINARY_API_SECRET || "BMHCHGPN1zDW9oQrUc0V9hvzVw4",
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit to handle base64 image uploads
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // API Route: Cloudinary Upload
  app.post("/api/upload", async (req, res) => {
    try {
      const { image, cloudName, apiKey, apiSecret } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      // Allow dynamic credentials from the frontend settings if provided
      const finalCloudName = cloudName || process.env.CLOUDINARY_CLOUD_NAME || "dlnyyzwvx";
      const finalApiKey = apiKey || process.env.CLOUDINARY_API_KEY || "633679995456178";
      const finalApiSecret = apiSecret || process.env.CLOUDINARY_API_SECRET || "BMHCHGPN1zDW9oQrUc0V9hvzVw4";

      // Configure on-the-fly if client overrides
      const client = cloudinary;
      client.config({
        cloud_name: finalCloudName,
        api_key: finalApiKey,
        api_secret: finalApiSecret,
      });

      // Upload base64 image to Cloudinary
      const uploadResult = await client.uploader.upload(image, {
        folder: "bug_reporter",
        resource_type: "auto"
      });

      res.json({
        success: true,
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
      });
    } catch (error: any) {
      console.error("Cloudinary upload error:", error);
      res.status(500).json({
        error: error.message || "Failed to upload image to Cloudinary",
      });
    }
  });

  // API Route: Get Server Configurations (safely prefilled or redacted and test Supabase connection server-side)
  app.get("/api/config", async (req, res) => {
    let cloudinaryConnected = false;
    try {
      const pingResult = await cloudinary.api.ping();
      cloudinaryConnected = pingResult.status === "ok";
    } catch (e) {
      console.warn("Cloudinary ping failed:", e);
    }

    // Check Supabase connection server-side (bypass client-side Ad-blockers)
    let supabaseConnected = false;
    let tablesExist = false;
    let dbError: string | null = null;
    try {
      const sUrl = process.env.SUPABASE_URL || "https://ekhtfzpkyjrvewrhcbor.supabase.co";
      const sKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraHRmenBreWpydmV3cmhjYm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMjM0ODUsImV4cCI6MjA5OTY5OTQ4NX0.qLeyzHMgnw1PkOek-XQgyTfWj_RHmVszV-nqY-A1FLQ";
      const { createClient } = await import("@supabase/supabase-js");
      const sClient = createClient(sUrl, sKey);
      const { error } = await sClient.from("users").select("id").limit(1);
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          supabaseConnected = true;
          tablesExist = false;
          dbError = error.message;
        } else {
          dbError = error.message;
        }
      } else {
        supabaseConnected = true;
        tablesExist = true;
      }
    } catch (err: any) {
      dbError = err.message;
    }

    res.json({
      cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "dlnyyzwvx",
      cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "633679995456178",
      supabaseUrl: process.env.SUPABASE_URL || "https://ekhtfzpkyjrvewrhcbor.supabase.co",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraHRmenBreWpydmV3cmhjYm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMjM0ODUsImV4cCI6MjA5OTY5OTQ4NX0.qLeyzHMgnw1PkOek-XQgyTfWj_RHmVszV-nqY-A1FLQ",
      cloudinaryConnected,
      supabaseConnected,
      tablesExist,
      dbError,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

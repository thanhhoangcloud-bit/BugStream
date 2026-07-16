import express from "express";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dlnyyzwvx",
  api_key: process.env.CLOUDINARY_API_KEY || "633679995456178",
  api_secret: process.env.CLOUDINARY_API_SECRET || "BMHCHGPN1zDW9oQrUc0V9hvzVw4",
});

const app = express();

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

app.post("/api/upload", async (req, res) => {
  try {
    const { image, cloudName, apiKey, apiSecret } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    const finalCloudName = cloudName || process.env.CLOUDINARY_CLOUD_NAME || "dlnyyzwvx";
    const finalApiKey = apiKey || process.env.CLOUDINARY_API_KEY || "633679995456178";
    const finalApiSecret = apiSecret || process.env.CLOUDINARY_API_SECRET || "BMHCHGPN1zDW9oQrUc0V9hvzVw4";

    const client = cloudinary;
    client.config({
      cloud_name: finalCloudName,
      api_key: finalApiKey,
      api_secret: finalApiSecret,
    });

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

app.get("/api/config", async (req, res) => {
  let cloudinaryConnected = false;
  try {
    const pingResult = await cloudinary.api.ping();
    cloudinaryConnected = pingResult.status === "ok";
  } catch (e) {
    console.warn("Cloudinary ping failed:", e);
  }

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

export default app;

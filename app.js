require("dotenv").config();
const express = require("express");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const cors = require("cors");
const sharp = require("sharp");
const FormData = require("form-data");
const { generateCareRecommendations, formatCareReport } = require("./utils/care-engine");
const { analyzePlantWithGemini, generateCareWithGemini } = require("./utils/gemini-vision");
const { identifyPlantWithPlantId, checkPlantHealth } = require("./utils/plantid-api");
const { validatePlantImage } = require("./utils/image-validator");

const app = express();
const port = process.env.PORT || 5000;

// Configure CORS
app.use(cors());

// Configure multer for memory storage (important for Vercel)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(express.static("public"));

// Routes
// Analyze
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    // Get image data from memory storage
    const originalImageData = req.file.buffer;
    console.log(`Received image of size: ${originalImageData.length} bytes`);

    // Keep original image for PDF report
    const originalImageBase64 = originalImageData.toString('base64');
    
    // Step 0: Validate that the image contains a plant
    console.log("Step 0/3: Validating image contains a plant...");
    const validation = await validatePlantImage(originalImageData, req.file.mimetype);
    
    if (!validation.isPlant && validation.confidence !== "unknown") {
      console.log(`❌ Not a plant detected: ${validation.detected}`);
      console.log(`Reason: ${validation.reason}`);
      
      return res.status(400).json({ 
        error: "Not a plant image",
        message: `This appears to be ${validation.detected}, not a plant. Please upload an image of a plant (houseplant, flower, tree, succulent, etc.).`,
        detected: validation.detected,
        reason: validation.reason
      });
    }
    
    console.log(`✅ Plant image validated (confidence: ${validation.confidence})`);
    if (validation.detected) {
      console.log(`Detected: ${validation.detected}`);
    }
    
    // Step 1: Identify plant using Plant.id API (100/day FREE, most reliable!)
    console.log("\nStep 1/3: Analyzing YOUR plant with Plant.id AI...");
    console.log("⏳ This may take 5-10 seconds...");

    let plantType = "Unknown plant";
    let scientificName = "";
    let commonNames = [];
    let confidence = "N/A";
    let plantFamily = "";
    let healthStatus = "Unknown";
    let healthDetails = "";

    // Try Plant.id first (most reliable, 100/day free, works with 'demo' key!)
    const plantidResult = await identifyPlantWithPlantId(originalImageData, req.file.mimetype);
    
    if (plantidResult.success) {
      const data = plantidResult.data;
      
      plantType = data.commonName || data.scientificName;
      scientificName = data.scientificName;
      plantFamily = data.family;
      confidence = `${data.confidence}%`;
      commonNames = data.alternativeNames;
      
      console.log(`🌿 Plant.id identified: ${plantType} (${scientificName})`);
      console.log(`📊 Confidence: ${confidence}`);
      console.log(`🏷️  Family: ${plantFamily}`);
      
      // Try to get health assessment
      const healthResult = await checkPlantHealth(originalImageData, req.file.mimetype);
      if (healthResult.success) {
        healthStatus = healthResult.data.isHealthy ? "healthy" : "needs attention";
        console.log(`💚 Health: ${healthStatus}`);
        if (healthResult.data.diseases && healthResult.data.diseases.length > 0) {
          console.log(`⚠️  Detected issues: ${healthResult.data.diseases.map(d => d.name).join(', ')}`);
        }
      }
    } else {
      // Fallback to Gemini if Plant.id fails
      console.log("⚠️ Plant.id unavailable, trying Gemini...");
      const geminiResult = await analyzePlantWithGemini(originalImageData, req.file.mimetype);
      
      if (geminiResult.success) {
      const analysis = geminiResult.data;
      
      plantType = analysis.identification.commonName || "Unknown plant";
      scientificName = analysis.identification.scientificName || "Unknown species";
      plantFamily = analysis.identification.family || "Unknown family";
      confidence = analysis.identification.confidence || "medium";
      healthStatus = analysis.health.status || "unknown";
      healthDetails = analysis.health.overallAssessment || "";
      
      console.log(`🌿 Gemini identified: ${plantType} (${scientificName})`);
      console.log(`📊 Confidence: ${confidence}`);
      console.log(`🏷️  Family: ${plantFamily}`);
      console.log(`💚 Health: ${healthStatus}`);
      
      if (analysis.health.symptoms && analysis.health.symptoms.length > 0) {
        console.log(`⚠️  Symptoms: ${analysis.health.symptoms.join(', ')}`);
      }
      } else {
        // Fallback to PlantNet if Gemini fails
        console.log("⚠️ Gemini unavailable, trying PlantNet...");
      
      try {
        const fetch = (await import('node-fetch')).default;
        
        const formData = new FormData();
        formData.append('images', originalImageData, {
          filename: 'plant.jpg',
          contentType: req.file.mimetype
        });
        formData.append('organs', 'auto');
        
        const plantnetResponse = await fetch(
          `https://my-api.plantnet.org/v2/identify/all?api-key=${process.env.PLANTNET_API_KEY}`,
          {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
          }
        );
        
        const plantnetResult = await plantnetResponse.json();
        
        if (plantnetResult && plantnetResult.results && plantnetResult.results.length > 0) {
          const topResult = plantnetResult.results[0];
          
          scientificName = topResult.species.scientificNameWithoutAuthor || topResult.species.scientificName;
          commonNames = topResult.species.commonNames || [];
          plantType = commonNames.length > 0 ? commonNames[0] : scientificName;
          confidence = `${(topResult.score * 100).toFixed(1)}%`;
          plantFamily = topResult.species.family?.scientificName || "";
          
          console.log(`🌿 PlantNet identified: ${plantType} (${scientificName})`);
          console.log(`📊 Confidence: ${confidence}`);
        } else {
          throw new Error("No PlantNet results");
        }
      } catch (plantnetError) {
        console.log("⚠️ All APIs unavailable");
        console.log("Using knowledge-based general analysis");
        
        plantType = "your plant";
        scientificName = "Unknown species";
        plantFamily = "Unknown family";
      }
      }
    }

    // Step 2: Generate care recommendations using knowledge base
    console.log("Step 2/2: Generating tailored care guide from knowledge base...");
    
    const plantData = {
      plantType,
      scientificName,
      plantFamily,
      confidence,
      commonNames
    };
    
    const careReport = generateCareRecommendations(plantData);
    const plantInfo = formatCareReport(careReport);
    
    console.log("✅ Care recommendations generated from knowledge base!");

    // Add AI analysis summary
    const finalReport = plantInfo + `

---
🤖 AI Analysis Summary:
• Common name: ${plantType}
• Scientific name: ${scientificName}
• Family: ${plantFamily}
• Confidence: ${confidence}%
• Identified by PlantNet AI
• Analysis based on your specific plant image`;
    
    console.log("Plant analysis complete!");
    
    console.log("Analysis complete!");
    res.json({ result: finalReport, image: `data:${req.file.mimetype};base64,${originalImageBase64}` });
  } catch (error) {
    console.error("❌ Error analyzing image:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // Send detailed error to help with debugging
    res.status(500).json({ 
      error: "An error occurred while analyzing the image",
      details: error.message,
      type: error.name
    });
  }
});

// Download PDF
app.post("/api/download", express.json(), async (req, res) => {
  const { result, image } = req.body;
  try {
    // Create PDF in memory instead of file system
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=plant_analysis_report.pdf');
      res.send(pdfBuffer);
    });
    
    // Add content to the PDF
    doc.fontSize(24).text("Plant Analysis Report", {
      align: "center",
    });
    doc.moveDown();
    doc.fontSize(24).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.fontSize(14).text(result, { align: "left" });
    // Insert image to the PDF
    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      doc.moveDown();
      doc.image(buffer, {
        fit: [500, 300],
        align: "center",
        valign: "center",
      });
    }
    doc.end();
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res
      .status(500)
      .json({ error: "An error occurred while generating the PDF report" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Serve static files for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Vercel specific export
module.exports = app;

// Start the server only when not in Vercel environment
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}
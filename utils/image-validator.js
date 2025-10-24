const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Validate if uploaded image contains a plant
 * @param {Buffer} imageBuffer - Image data as buffer
 * @param {string} mimeType - Image MIME type
 * @returns {Object} - Validation result
 */
async function validatePlantImage(imageBuffer, mimeType) {
  try {
    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY) {
      // Skip validation if no API key
      return { isPlant: true, confidence: "unknown", message: "Validation skipped" };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Analyze this image and determine if it contains a plant (houseplant, outdoor plant, tree, flower, succulent, etc.).

Respond with ONLY a JSON object in this exact format:
{
  "isPlant": true or false,
  "confidence": "high" or "medium" or "low",
  "detected": "description of what you see",
  "reason": "brief explanation"
}

Examples:
- If it's a plant: {"isPlant": true, "confidence": "high", "detected": "Monstera plant", "reason": "Clear image of a houseplant with distinctive leaves"}
- If it's not a plant: {"isPlant": false, "confidence": "high", "detected": "cat", "reason": "Image shows an animal, not a plant"}
- If unclear: {"isPlant": false, "confidence": "low", "detected": "unclear object", "reason": "Cannot determine if this is a plant"}`;

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    let jsonText = text;
    if (text.includes("```json")) {
      jsonText = text.split("```json")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      jsonText = text.split("```")[1].split("```")[0].trim();
    }

    const validation = JSON.parse(jsonText);
    
    return {
      isPlant: validation.isPlant,
      confidence: validation.confidence,
      detected: validation.detected,
      reason: validation.reason
    };

  } catch (error) {
    console.error("Image validation error:", error.message);
    // If validation fails, assume it's a plant (fail open)
    return { isPlant: true, confidence: "unknown", message: "Validation failed, proceeding anyway" };
  }
}

module.exports = {
  validatePlantImage
};

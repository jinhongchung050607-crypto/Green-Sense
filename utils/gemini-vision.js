const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Analyze plant image using Google Gemini Vision
 * @param {Buffer} imageBuffer - Image data as buffer
 * @param {string} mimeType - Image MIME type
 * @returns {Object} - Plant identification and health analysis
 */
async function analyzePlantWithGemini(imageBuffer, mimeType) {
  try {
    // Check if API key is set
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not set in environment variables");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an expert botanist. Analyze this plant image and provide:

1. Plant Identification:
   - Common name
   - Scientific name (if identifiable)
   - Plant family
   - Confidence level (high/medium/low)

2. Health Assessment:
   - Overall health status (healthy/stressed/diseased)
   - Visible symptoms or issues
   - Leaf condition
   - Growth pattern

3. Observable Characteristics:
   - Leaf shape and color
   - Plant size/maturity
   - Any visible pests or diseases
   - Growing conditions (if visible)

Format your response as JSON with this structure:
{
  "identification": {
    "commonName": "string",
    "scientificName": "string",
    "family": "string",
    "confidence": "high|medium|low"
  },
  "health": {
    "status": "healthy|stressed|diseased",
    "symptoms": ["array of visible symptoms"],
    "leafCondition": "string",
    "overallAssessment": "string"
  },
  "characteristics": {
    "leafShape": "string",
    "leafColor": "string",
    "maturity": "string",
    "visibleIssues": ["array"]
  }
}

Be specific and accurate. If you're uncertain about identification, indicate lower confidence.`;

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text;
    if (text.includes("```json")) {
      jsonText = text.split("```json")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      jsonText = text.split("```")[1].split("```")[0].trim();
    }

    const analysis = JSON.parse(jsonText);
    
    return {
      success: true,
      data: analysis
    };

  } catch (error) {
    console.error("Gemini Vision error:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate care recommendations using Gemini
 * @param {Object} plantData - Plant identification data
 * @returns {string} - Care recommendations
 */
async function generateCareWithGemini(plantData) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an expert botanist. Based on this plant identification:
- Common Name: ${plantData.commonName}
- Scientific Name: ${plantData.scientificName}
- Family: ${plantData.family}
- Health Status: ${plantData.healthStatus}

Provide a comprehensive care guide with:

1. WATERING
   - Frequency and amount
   - Signs of over/underwatering
   - Water quality tips

2. LIGHT REQUIREMENTS
   - Ideal light conditions
   - Signs of too much/little light
   - Placement recommendations

3. SOIL & FERTILIZER
   - Soil type and pH
   - Fertilizer schedule
   - Nutrient requirements

4. TEMPERATURE & HUMIDITY
   - Ideal ranges
   - Seasonal adjustments
   - Protection from extremes

5. COMMON PROBLEMS
   - Pests and diseases specific to this plant
   - Prevention strategies
   - Treatment options

6. SEASONAL CARE
   - Spring/Summer tasks
   - Fall/Winter adjustments

Be specific to this plant species. Provide actionable, practical advice.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("Gemini care generation error:", error.message);
    return null;
  }
}

module.exports = {
  analyzePlantWithGemini,
  generateCareWithGemini
};

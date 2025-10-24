const fetch = require('node-fetch');

/**
 * Identify plant using Plant.id API (100/day FREE, no credit card)
 * More reliable than PlantNet!
 * @param {Buffer} imageBuffer - Image data as buffer
 * @param {string} mimeType - Image MIME type
 * @returns {Object} - Plant identification and health analysis
 */
async function identifyPlantWithPlantId(imageBuffer, mimeType) {
  try {
    // Plant.id API endpoint
    const apiKey = process.env.PLANTID_API_KEY || 'demo'; // Use 'demo' for testing
    const apiUrl = 'https://api.plant.id/v2/identify';
    
    // Convert image to base64
    const base64Image = imageBuffer.toString('base64');
    const imageData = `data:${mimeType};base64,${base64Image}`;
    
    // Prepare request
    const requestBody = {
      api_key: apiKey,
      images: [imageData],
      modifiers: ["crops_fast", "similar_images"],
      plant_language: "en",
      plant_details: [
        "common_names",
        "url",
        "name_authority",
        "wiki_description",
        "taxonomy",
        "synonyms"
      ]
    };
    
    console.log('🔍 Calling Plant.id API...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Plant.id API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Check if we got suggestions
    if (!result.suggestions || result.suggestions.length === 0) {
      return {
        success: false,
        error: 'No plant suggestions found'
      };
    }
    
    // Get top suggestion
    const topSuggestion = result.suggestions[0];
    
    return {
      success: true,
      data: {
        commonName: topSuggestion.plant_details?.common_names?.[0] || topSuggestion.plant_name,
        scientificName: topSuggestion.plant_name,
        family: topSuggestion.plant_details?.taxonomy?.family || 'Unknown',
        genus: topSuggestion.plant_details?.taxonomy?.genus || 'Unknown',
        confidence: (topSuggestion.probability * 100).toFixed(1),
        alternativeNames: topSuggestion.plant_details?.common_names || [],
        description: topSuggestion.plant_details?.wiki_description?.value || '',
        similarImages: topSuggestion.similar_images || []
      }
    };
    
  } catch (error) {
    console.error('Plant.id API error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check plant health using Plant.id API
 * @param {Buffer} imageBuffer - Image data as buffer
 * @param {string} mimeType - Image MIME type
 * @returns {Object} - Health assessment
 */
async function checkPlantHealth(imageBuffer, mimeType) {
  try {
    const apiKey = process.env.PLANTID_API_KEY || 'demo';
    const apiUrl = 'https://api.plant.id/v2/health_assessment';
    
    const base64Image = imageBuffer.toString('base64');
    const imageData = `data:${mimeType};base64,${base64Image}`;
    
    const requestBody = {
      api_key: apiKey,
      images: [imageData],
      modifiers: ["crops_fast", "similar_images"],
      disease_details: ["cause", "common_names", "classification", "description", "treatment", "url"]
    };
    
    console.log('🏥 Checking plant health...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Health check error: ${response.status}`);
    }
    
    const result = await response.json();
    
    return {
      success: true,
      data: {
        isHealthy: result.health_assessment?.is_healthy || true,
        diseases: result.health_assessment?.diseases || [],
        healthScore: result.health_assessment?.is_healthy_probability || 1.0
      }
    };
    
  } catch (error) {
    console.error('Health check error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  identifyPlantWithPlantId,
  checkPlantHealth
};

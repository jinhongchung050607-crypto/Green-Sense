const fs = require('fs');
const path = require('path');

// Load knowledge bases
const diseases = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledge/plant-diseases.json'), 'utf8'));
const careData = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledge/plant-care.json'), 'utf8'));

/**
 * Generate comprehensive care recommendations based on PlantNet identification
 * @param {Object} plantnetData - Data from PlantNet API
 * @returns {Object} - Comprehensive care recommendations
 */
function generateCareRecommendations(plantnetData) {
  const { plantType, scientificName, plantFamily, confidence, commonNames } = plantnetData;
  
  // Get family-specific care if available
  const familyCare = careData.care_by_family[plantFamily] || null;
  
  // Build comprehensive report
  const report = {
    identification: {
      commonName: plantType,
      scientificName: scientificName,
      family: plantFamily,
      confidence: `${confidence}%`,
      alternativeNames: commonNames
    },
    careRequirements: familyCare ? {
      watering: familyCare.watering,
      light: familyCare.light,
      humidity: familyCare.humidity,
      temperature: familyCare.temperature,
      soil: familyCare.soil,
      fertilizer: familyCare.fertilizer
    } : getGeneralCare(),
    commonIssues: familyCare ? familyCare.common_issues : [
      "Monitor for pests regularly",
      "Check soil moisture before watering",
      "Ensure adequate drainage"
    ],
    healthTips: getHealthTips(),
    seasonalCare: getSeasonalCare(),
    troubleshooting: getTroubleshootingGuide()
  };
  
  return report;
}

/**
 * Analyze potential diseases based on symptoms
 * @param {Array} symptoms - List of observed symptoms
 * @returns {Array} - Possible diseases and treatments
 */
function analyzeDiseases(symptoms) {
  const possibleDiseases = [];
  
  diseases.common_diseases.forEach(disease => {
    const matchCount = disease.symptoms.filter(symptom => 
      symptoms.some(s => s.toLowerCase().includes(symptom.toLowerCase()))
    ).length;
    
    if (matchCount > 0) {
      possibleDiseases.push({
        name: disease.name,
        matchScore: matchCount / disease.symptoms.length,
        symptoms: disease.symptoms,
        causes: disease.causes,
        treatment: disease.treatment,
        prevention: disease.prevention
      });
    }
  });
  
  // Sort by match score
  return possibleDiseases.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Get general care recommendations
 */
function getGeneralCare() {
  return {
    watering: "Water when top 1-2 inches of soil are dry. Adjust based on season and humidity.",
    light: "Bright, indirect light is suitable for most houseplants. Avoid direct harsh sunlight.",
    humidity: "Average household humidity (40-50%) works for most plants. Increase for tropical species.",
    temperature: "65-75°F (18-24°C) is ideal for most indoor plants.",
    soil: "Well-draining potting mix. Ensure pot has drainage holes.",
    fertilizer: "Feed monthly during spring and summer with balanced liquid fertilizer."
  };
}

/**
 * Get health tips
 */
function getHealthTips() {
  return [
    "🔍 Inspect leaves weekly for pests or disease",
    "💧 Water quality matters - use filtered or room-temperature water",
    "🔄 Rotate plant weekly for even growth",
    "🧹 Clean leaves monthly to remove dust",
    "✂️ Prune dead or yellowing leaves promptly",
    "🚫 Quarantine new plants for 2 weeks before placing with others"
  ];
}

/**
 * Get seasonal care guide
 */
function getSeasonalCare() {
  return {
    spring: {
      tasks: ["Repot if root-bound", "Increase watering frequency", "Start fertilizing", "Prune for shape"],
      notes: "Active growing season begins. Plants need more water and nutrients."
    },
    summer: {
      tasks: ["Water more frequently", "Watch for pests", "Provide shade if needed", "Maintain humidity"],
      notes: "Peak growing season. Monitor for heat stress and increase watering."
    },
    fall: {
      tasks: ["Reduce watering", "Stop fertilizing", "Bring outdoor plants inside", "Reduce humidity"],
      notes: "Growth slows down. Prepare plants for dormancy period."
    },
    winter: {
      tasks: ["Water sparingly", "No fertilizer", "Protect from cold drafts", "Provide adequate light"],
      notes: "Dormancy period. Most plants need less water and no fertilizer."
    }
  };
}

/**
 * Get troubleshooting guide
 */
function getTroubleshootingGuide() {
  return {
    "Yellow Leaves": {
      possible_causes: ["Overwatering", "Nutrient deficiency", "Natural aging", "Root rot"],
      solutions: ["Check soil moisture", "Reduce watering frequency", "Apply balanced fertilizer", "Check roots for rot"]
    },
    "Brown Tips": {
      possible_causes: ["Low humidity", "Fluoride in water", "Over-fertilization", "Underwatering"],
      solutions: ["Increase humidity", "Use filtered water", "Reduce fertilizer", "Water more consistently"]
    },
    "Wilting": {
      possible_causes: ["Underwatering", "Overwatering", "Root rot", "Heat stress"],
      solutions: ["Check soil moisture", "Adjust watering schedule", "Check roots", "Move to cooler location"]
    },
    "Drooping Leaves": {
      possible_causes: ["Underwatering", "Overwatering", "Temperature shock", "Root issues"],
      solutions: ["Water if soil is dry", "Check for root rot if soil is wet", "Maintain stable temperature"]
    },
    "Slow Growth": {
      possible_causes: ["Insufficient light", "Lack of nutrients", "Root-bound", "Dormancy"],
      solutions: ["Move to brighter location", "Fertilize during growing season", "Repot if needed", "Be patient in winter"]
    },
    "Leaf Drop": {
      possible_causes: ["Environmental stress", "Overwatering", "Pest infestation", "Natural process"],
      solutions: ["Maintain consistent conditions", "Check watering schedule", "Inspect for pests", "Monitor new growth"]
    }
  };
}

/**
 * Format care report as readable text
 */
function formatCareReport(report) {
  let text = `🌿 PLANT ANALYSIS REPORT\n\n`;
  
  // Identification
  text += `📋 IDENTIFICATION\n`;
  text += `• Common Name: ${report.identification.commonName}\n`;
  text += `• Scientific Name: ${report.identification.scientificName}\n`;
  text += `• Family: ${report.identification.family}\n`;
  text += `• Confidence: ${report.identification.confidence}\n`;
  if (report.identification.alternativeNames && report.identification.alternativeNames.length > 1) {
    text += `• Other Names: ${report.identification.alternativeNames.slice(1, 3).join(', ')}\n`;
  }
  text += `\n`;
  
  // Care Requirements
  text += `💚 CARE REQUIREMENTS\n`;
  text += `• Watering: ${report.careRequirements.watering}\n`;
  text += `• Light: ${report.careRequirements.light}\n`;
  text += `• Humidity: ${report.careRequirements.humidity}\n`;
  text += `• Temperature: ${report.careRequirements.temperature}\n`;
  text += `• Soil: ${report.careRequirements.soil}\n`;
  text += `• Fertilizer: ${report.careRequirements.fertilizer}\n`;
  text += `\n`;
  
  // Common Issues
  text += `⚠️ COMMON ISSUES TO WATCH FOR\n`;
  report.commonIssues.forEach(issue => {
    text += `• ${issue}\n`;
  });
  text += `\n`;
  
  // Health Tips
  text += `✨ HEALTH TIPS\n`;
  report.healthTips.forEach(tip => {
    text += `${tip}\n`;
  });
  text += `\n`;
  
  // Seasonal Care
  text += `📅 SEASONAL CARE GUIDE\n`;
  Object.entries(report.seasonalCare).forEach(([season, care]) => {
    text += `\n${season.toUpperCase()}:\n`;
    text += `${care.notes}\n`;
    care.tasks.forEach(task => {
      text += `  ✓ ${task}\n`;
    });
  });
  text += `\n`;
  
  // Troubleshooting
  text += `🔧 TROUBLESHOOTING GUIDE\n`;
  Object.entries(report.troubleshooting).forEach(([problem, info]) => {
    text += `\n${problem}:\n`;
    text += `Possible causes: ${info.possible_causes.join(', ')}\n`;
    text += `Solutions:\n`;
    info.solutions.forEach(solution => {
      text += `  • ${solution}\n`;
    });
  });
  
  return text;
}

module.exports = {
  generateCareRecommendations,
  analyzeDiseases,
  formatCareReport
};

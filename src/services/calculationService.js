const logger = require('../utils/logger');

class CalculationService {
  calculateLargeFormatAmount(widthCm, heightCm, rate) {
    if (!widthCm || !heightCm || widthCm <= 0 || heightCm <= 0) {
      throw new Error('Invalid dimensions: width and height must be positive numbers');
    }

    if (!rate || rate <= 0) {
      throw new Error('Invalid rate: rate must be a positive number');
    }

    const widthM = widthCm / 100;
    const heightM = heightCm / 100;
    const area = widthM * heightM;
    const amount = area * rate;

    const result = {
      widthM: parseFloat(widthM.toFixed(4)),
      heightM: parseFloat(heightM.toFixed(4)),
      area: parseFloat(area.toFixed(4)),
      rate: parseFloat(rate.toFixed(2)),
      amount: parseFloat(amount.toFixed(2))
    };

    logger.debug('Large format calculation', result);
    return result;
  }

  calculateDigitalPressAmount(quantity, rate) {
    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new Error('Invalid quantity: quantity must be a positive integer');
    }

    if (!rate || rate <= 0) {
      throw new Error('Invalid rate: rate must be a positive number');
    }

    const amount = quantity * rate;

    const result = {
      quantity: parseInt(quantity, 10),
      rate: parseFloat(rate.toFixed(2)),
      amount: parseFloat(amount.toFixed(2))
    };

    logger.debug('Digital press calculation', result);
    return result;
  }

  calculateJobAmount(machineType, dimensions, rate) {
    try {
      if (machineType === 'large_format') {
        if (!dimensions.width_cm || !dimensions.height_cm) {
          throw new Error('Large format jobs require width_cm and height_cm');
        }
        return this.calculateLargeFormatAmount(
          dimensions.width_cm,
          dimensions.height_cm,
          rate
        );
      }

      if (machineType === 'digital_press') {
        if (!dimensions.quantity) {
          throw new Error('Digital press jobs require quantity');
        }
        return this.calculateDigitalPressAmount(
          dimensions.quantity,
          rate
        );
      }

      throw new Error(`Unknown machine type: ${machineType}`);
    } catch (error) {
      logger.error('Calculation failed', {
        machineType,
        dimensions,
        rate,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new CalculationService();

import * as tf from '@tensorflow/tfjs';
import { Platform } from 'react-native';

interface CognitiveFeatures {
  sessionDurationMinutes: number;
  taskSwitchCount: number;
  focusScore: number;
  interruptionCount: number;
  timeOfDay: number;
  dayOfWeek: number;
  previousOverloadIndex: number;
  avgTaskDuration: number;
}

interface PredictionResult {
  overloadProbability: number;
  focusTrend: 'improving' | 'stable' | 'declining';
  recommendedBreakInterval: number;
  confidence: number;
}

export class CognitiveOverloadPredictor {
  private model: tf.LayersModel | null = null;
  private isTraining = false;
  private readonly featureCount = 8;
  private trainingData: { features: CognitiveFeatures; label: number }[] = [];
  private readonly maxTrainingData = 1000;

  async initialize(): Promise<void> {
    if (this.model) return;

    try {
      if (Platform.OS === 'web') {
        await tf.setBackend('cpu');
      }

      this.model = this.createModel();
      await this.loadPretrainedWeights();
    } catch (error) {
      console.warn('TensorFlow initialization failed, using fallback:', error);
      this.model = null;
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.featureCount],
          units: 64,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu',
        }),
        tf.layers.dense({
          units: 3,
          activation: 'sigmoid',
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse'],
    });

    return model;
  }

  private async loadPretrainedWeights(): Promise<void> {
    // Simulate pretrained weights based on research data
    // In production, this would load from a saved model
  }

  private normalizeFeatures(features: CognitiveFeatures): number[] {
    return [
      features.sessionDurationMinutes / 120,
      Math.min(features.taskSwitchCount / 20, 1),
      features.focusScore / 100,
      Math.min(features.interruptionCount / 10, 1),
      features.timeOfDay / 24,
      features.dayOfWeek / 7,
      features.previousOverloadIndex / 100,
      Math.min(features.avgTaskDuration / 60, 1),
    ];
  }

  async predict(features: CognitiveFeatures): Promise<PredictionResult> {
    if (!this.model) {
      return this.fallbackPrediction(features);
    }

    try {
      const normalizedFeatures = this.normalizeFeatures(features);
      const inputTensor = tf.tensor2d([normalizedFeatures]);

      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const values = await prediction.data();

      inputTensor.dispose();
      prediction.dispose();

      const [overloadProb, focusTrendValue, breakIntervalNorm] = Array.from(values);

      return {
        overloadProbability: Math.round(overloadProb * 100),
        focusTrend: this.interpretFocusTrend(focusTrendValue),
        recommendedBreakInterval: Math.round(15 + breakIntervalNorm * 45),
        confidence: this.calculateConfidence(features),
      };
    } catch (error) {
      console.warn('ML prediction failed, using fallback:', error);
      return this.fallbackPrediction(features);
    }
  }

  private fallbackPrediction(features: CognitiveFeatures): PredictionResult {
    let overloadProb = 0;
    let focusTrend: 'improving' | 'stable' | 'declining' = 'stable';

    if (features.sessionDurationMinutes > 60) overloadProb += 0.3;
    if (features.taskSwitchCount > 10) overloadProb += 0.25;
    if (features.focusScore < 50) overloadProb += 0.2;
    if (features.interruptionCount > 5) overloadProb += 0.15;
    if (features.previousOverloadIndex > 60) overloadProb += 0.2;

    if (features.focusScore > features.previousOverloadIndex) {
      focusTrend = 'improving';
    } else if (features.focusScore < features.previousOverloadIndex - 10) {
      focusTrend = 'declining';
    }

    const breakInterval = overloadProb > 0.6 ? 20 : 
                         overloadProb > 0.4 ? 30 : 45;

    return {
      overloadProbability: Math.round(Math.min(overloadProb, 1) * 100),
      focusTrend,
      recommendedBreakInterval: breakInterval,
      confidence: 0.6,
    };
  }

  private interpretFocusTrend(value: number): 'improving' | 'stable' | 'declining' {
    if (value > 0.6) return 'improving';
    if (value < 0.4) return 'declining';
    return 'stable';
  }

  private calculateConfidence(features: CognitiveFeatures): number {
    let confidence = 0.7;
    
    if (features.sessionDurationMinutes > 10) confidence += 0.1;
    if (features.taskSwitchCount > 0) confidence += 0.1;
    if (features.previousOverloadIndex > 0) confidence += 0.1;
    
    return Math.min(0.95, confidence);
  }

  async train(features: CognitiveFeatures, actualOverloadIndex: number): Promise<void> {
    if (!this.model || this.isTraining) return;

    this.trainingData.push({ features, label: actualOverloadIndex / 100 });
    
    if (this.trainingData.length > this.maxTrainingData) {
      this.trainingData = this.trainingData.slice(-this.maxTrainingData);
    }

    if (this.trainingData.length >= 32) {
      await this.performTraining();
    }
  }

  private async performTraining(): Promise<void> {
    if (!this.model || this.trainingData.length < 32) return;

    this.isTraining = true;

    try {
      const batchSize = Math.min(32, this.trainingData.length);
      const batch = this.trainingData.slice(-batchSize);

      const xs = tf.tensor2d(batch.map(d => this.normalizeFeatures(d.features)));
      const ys = tf.tensor2d(batch.map(d => [d.label, d.label > 0.5 ? 0.3 : 0.7, 0.5]));

      await this.model.fit(xs, ys, {
        epochs: 1,
        verbose: 0,
        batchSize,
      });

      xs.dispose();
      ys.dispose();
    } catch (error) {
      console.warn('Training failed:', error);
    } finally {
      this.isTraining = false;
    }
  }

  getModelStatus(): { isReady: boolean; trainingDataSize: number; isTraining: boolean } {
    return {
      isReady: this.model !== null,
      trainingDataSize: this.trainingData.length,
      isTraining: this.isTraining,
    };
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.trainingData = [];
  }
}

export const cognitivePredictor = new CognitiveOverloadPredictor();

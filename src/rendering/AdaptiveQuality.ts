export type QualityTier = 'low' | 'medium' | 'high';

export interface AdaptiveQualityOptions {
  initialPixelRatio: number;
  minPixelRatio: number;
  maxPixelRatio: number;
  targetFps?: number;
  onTierChange?: (tier: QualityTier) => void;
}

export class AdaptiveQualityController {
  public pixelRatio: number;
  public qualityTier: QualityTier = 'medium';
  public onTierChange?: (tier: QualityTier) => void;

  private readonly minPixelRatio: number;
  private readonly maxPixelRatio: number;
  private readonly targetFrameTime: number;
  private frameTimeAverage = 1 / 60;
  private slowFrames = 0;
  private fastFrames = 0;

  constructor(options: AdaptiveQualityOptions) {
    this.minPixelRatio = options.minPixelRatio;
    this.maxPixelRatio = options.maxPixelRatio;
    this.targetFrameTime = 1 / (options.targetFps ?? 60);
    this.pixelRatio = clamp(options.initialPixelRatio, this.minPixelRatio, this.maxPixelRatio);
    this.onTierChange = options.onTierChange;
    this.updateTier();
  }

  public sampleFrame(dt: number): boolean {
    const safeDt = clamp(dt, 1 / 240, 0.1);
    this.frameTimeAverage = this.frameTimeAverage * 0.92 + safeDt * 0.08;

    if (this.frameTimeAverage > this.targetFrameTime * 1.2) {
      this.slowFrames += 1;
      this.fastFrames = 0;
    } else if (this.frameTimeAverage < this.targetFrameTime * 0.62) {
      this.fastFrames += 1;
      this.slowFrames = 0;
    } else {
      this.slowFrames = Math.max(0, this.slowFrames - 1);
      this.fastFrames = Math.max(0, this.fastFrames - 1);
    }

    const beforeRatio = this.pixelRatio;
    if (this.slowFrames >= 45) {
      this.pixelRatio = clamp(this.pixelRatio - 0.15, this.minPixelRatio, this.maxPixelRatio);
      this.slowFrames = 0;
    }

    if (this.fastFrames >= 90) {
      this.pixelRatio = clamp(this.pixelRatio + 0.1, this.minPixelRatio, this.maxPixelRatio);
      this.fastFrames = 0;
    }

    this.updateTier();
    return beforeRatio !== this.pixelRatio;
  }

  public get averageFps(): number {
    return 1 / this.frameTimeAverage;
  }

  private updateTier() {
    const previousTier = this.qualityTier;
    if (this.averageFps < 52 || this.pixelRatio <= this.minPixelRatio + 0.2) {
      this.qualityTier = 'low';
    } else if (this.averageFps > 105 && this.pixelRatio >= 1) {
      this.qualityTier = 'high';
    } else {
      this.qualityTier = 'medium';
    }

    if (previousTier !== this.qualityTier && this.onTierChange) {
      this.onTierChange(this.qualityTier);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

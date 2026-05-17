export class GameLoop {
  private lastTime: number = 0;
  private accumulator: number = 0;
  private animationFrameId: number = 0;
  private isRunning: boolean = false;

  // Fixed timestep for physics and game logic (e.g. 64 tick or 128 tick equivalent)
  public fixedDeltaTime: number = 1 / 64; 
  public maxAccumulator: number = 0.25;

  constructor(
    private updateFn: (dt: number) => void,
    private renderFn: (dt: number, alpha: number) => void
  ) {}

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  private tick = (currentTime: number) => {
    if (!this.isRunning) return;

    // dt is in seconds
    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp dt to avoid spiral of death if the tab is inactive
    if (dt > this.maxAccumulator) {
      dt = this.maxAccumulator;
    }

    this.accumulator += dt;

    // Fixed timestep update for deterministic logic
    while (this.accumulator >= this.fixedDeltaTime) {
      this.updateFn(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
    }

    // Interpolation alpha for smooth rendering between logic ticks
    const alpha = this.accumulator / this.fixedDeltaTime;

    // Render with actual frame delta for smooth visual updates (like camera interpolation)
    this.renderFn(dt, alpha);

    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}

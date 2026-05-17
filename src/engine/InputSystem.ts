export class InputSystem {
  keys: Record<string, boolean> = {};
  mouseDown = false;
  mousePressed = false;
  interactPressed = false;
  mouseX = 0;
  mouseY = 0;
  pointerLocked = false;
  callbacks: {
    onMouseMove?: (dx: number, dy: number) => void;
    onMouseDown?: () => void;
    onMouseUp?: () => void;
    onInteract?: () => void;
    onReload?: () => void;
    onDrop?: () => void;
    onSlot?: (slot: number) => void;
    onScoreboard?: (show: boolean) => void;
    onBuyMenu?: () => void;
  } = {};

  constructor(private domElement: HTMLElement) {
    this.bindEvents();
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDownHandler);
    window.addEventListener('mouseup', this.onMouseUpHandler);
    window.addEventListener('mousemove', this.onMouseMoveHandler);
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDownHandler);
    window.removeEventListener('mouseup', this.onMouseUpHandler);
    window.removeEventListener('mousemove', this.onMouseMoveHandler);
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    if (e.code === 'KeyE' && !e.repeat) {
      this.interactPressed = true;
      this.callbacks.onInteract?.();
    }
    if (e.code === 'KeyR' && !e.repeat) this.callbacks.onReload?.();
    if (e.code === 'KeyG' && !e.repeat) this.callbacks.onDrop?.();
    if (e.code === 'Tab') { e.preventDefault(); this.callbacks.onScoreboard?.(true); }
    if (e.code === 'KeyB' && !e.repeat) this.callbacks.onBuyMenu?.();
    
    if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
      this.callbacks.onSlot?.(parseInt(e.code.replace('Digit', ''), 10));
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
    if (e.code === 'Tab') this.callbacks.onScoreboard?.(false);
  };

  private onMouseDownHandler = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    if (e.button === 0) {
      this.mouseDown = true;
      this.mousePressed = true;
      this.callbacks.onMouseDown?.();
    } else if (e.button === 2) {
      // Right click for scopes
      this.callbacks.onMouseUp?.(); // Using onMouseUp for right click scope right now is a placeholder, handle cleanly
    }
  };

  private onMouseUpHandler = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
  };

  private onMouseMoveHandler = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.mouseX += e.movementX;
    this.mouseY += e.movementY;
    this.callbacks.onMouseMove?.(e.movementX, e.movementY);
  };

  private onPointerDown = () => {
    if (!this.pointerLocked) this.domElement.requestPointerLock();
  };

  private onContextMenu = (e: MouseEvent) => e.preventDefault();

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.domElement;
  };

  consumeMousePressed() {
    const p = this.mousePressed;
    this.mousePressed = false;
    return p;
  }
}

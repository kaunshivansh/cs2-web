import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

export class GameRenderer {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  
  bloomPass: UnrealBloomPass;
  smaaPass: SMAAPass;

  constructor(canvasParent: HTMLElement, width: number, height: number) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // We use SMAA instead for better quality/performance trade-off in post
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
      stencil: false,
    });
    
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // AAA soft shadows
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15; // Slightly boosted for cinematic feel
    this.renderer.info.autoReset = false;
    
    canvasParent.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fa4b2);
    
    // Exponential fog for better depth (Volumetric approximation)
    this.scene.fog = new THREE.FogExp2(0x7f95a2, 0.008);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.05, 500);

    // --- Post Processing Stack ---
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType, // Better precision for HDR/Bloom
    });

    this.composer = new EffectComposer(this.renderer, renderTarget);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // AAA Bloom
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.65, // strength
      0.4,  // radius
      0.85  // threshold
    );
    this.composer.addPass(this.bloomPass);

    // Anti-Aliasing
    this.smaaPass = new SMAAPass();
    this.composer.addPass(this.smaaPass);

    // Tone mapping and color space output pass
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    
    const pixelRatio = this.renderer.getPixelRatio();
    this.smaaPass.setSize(width * pixelRatio, height * pixelRatio);
  }

  render(dt: number) {
    // We use composer instead of direct renderer to apply the AAA pipeline
    this.composer.render(dt);
    this.renderer.info.reset(); // clear debug info
  }

  dispose() {
    this.renderer.dispose();
    this.composer.dispose();
    const dom = this.renderer.domElement;
    if (dom && dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  }
}

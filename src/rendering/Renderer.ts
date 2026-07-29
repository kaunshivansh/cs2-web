import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { QualityTier } from './AdaptiveQuality.ts';

export class GameRenderer {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  
  bloomPass: UnrealBloomPass;
  smaaPass: SMAAPass;
  qualityTier: QualityTier = 'medium';

  constructor(canvasParent: HTMLElement, width: number, height: number) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
      stencil: false,
    });
    
    const initialPixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(initialPixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.info.autoReset = false;
    
    canvasParent.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fa4b2);
    this.scene.fog = new THREE.FogExp2(0x7f95a2, 0.008);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.05, 500);

    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });

    this.composer = new EffectComposer(this.renderer, renderTarget);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.45,
      0.35,
      0.82
    );
    this.composer.addPass(this.bloomPass);

    this.smaaPass = new SMAAPass();
    this.composer.addPass(this.smaaPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  setQualityTier(tier: QualityTier) {
    this.qualityTier = tier;
    if (tier === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.bloomPass.enabled = false;
      this.smaaPass.enabled = false;
      (this.scene.fog as THREE.FogExp2).density = 0.004;
    } else if (tier === 'medium') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.25;
      this.smaaPass.enabled = true;
      (this.scene.fog as THREE.FogExp2).density = 0.007;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.45;
      this.smaaPass.enabled = true;
      (this.scene.fog as THREE.FogExp2).density = 0.008;
    }
  }

  setPixelRatio(pixelRatio: number) {
    this.renderer.setPixelRatio(pixelRatio);
    this.composer.setPixelRatio(pixelRatio);
  }

  resize(width: number, height: number, pixelRatio?: number) {
    const pr = pixelRatio ?? this.renderer.getPixelRatio();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(width, height);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(width, height);
    this.smaaPass.setSize(width * pr, height * pr);
  }

  render(dt: number) {
    this.composer.render(dt);
    this.renderer.info.reset();
  }

  dispose() {
    this.composer.dispose();
    this.renderer.dispose();
    const dom = this.renderer.domElement;
    if (dom && dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  }
}

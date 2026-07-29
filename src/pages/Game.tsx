import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Team } from '../gameplay/match/MatchRules';
import {
  applyCounterStrafeToVelocity,
  applyGroundFrictionToVelocity,
  computeMovementSpeed,
} from '../gameplay/player/MovementModel';
import {
  advanceRecoilIndex,
  computePitchKick,
  computePlayerSpread,
  recoverRecoilIndex,
} from '../gameplay/player/WeaponFeel';
import {
  advanceAudibleEvents,
  updateBotBlackboard,
  type AudibleEvent,
} from '../ai/BotBlackboard';
import { createBotProfile, type BotDifficulty } from '../ai/TacticalDirector';
import { moveWithCapsuleCollision, lerpCrouchHeight } from '../gameplay/player/PlayerController';
import { findHitPart, type BodyPart } from '../gameplay/combat/Hitbox';
import { computeDamage, type DamageResult } from '../gameplay/combat/CombatSystem';
import { createAimState, setTarget, updateAim, getAimError, isAimReady, type AimState, type AimDifficulty, AIM_DIFFICULTY_PARAMS } from '../ai/AimSimulator';
import { createCombatSnapshot, advanceCombatState, shouldFireWeapon, shouldMove, type BotCombatSnapshot, type CombatContext } from '../ai/BotCombatController';
import { getBotPurchasePlan, updateBotAmmo, shouldBotReload, type TeamEconomy } from '../ai/BotEconomy';
import { buildNavGraph, findPath, smoothPath as navSmoothPath, findNearestNode, createBotNavState, updateNavState, isChokepointAvailable, distanceVec3, type NavGraph, type NavNode } from '../ai/Navigation';
import { getRecoilOffset, recoilToRadians, hasFirstShotAccuracy, movementSpreadPenalty, CAMERA_PUNCH_PITCH, CAMERA_PUNCH_RECOVERY_MS } from '../gameplay/player/RecoilPatterns';
import { audioSystem } from '../audio/AudioSystem';
import { AdaptiveQualityController } from '../rendering/AdaptiveQuality';
import { GameRenderer } from '../rendering/Renderer';
import {
  disposeObject3DResources,
  disposeObject3DResourcesWithOptions,
} from '../rendering/SceneDisposal';
import { getTeamVisualPalette } from '../rendering/viewmodel/TeamVisuals';
import { createWeaponModel } from '../rendering/viewmodel/WeaponModels';
import { createBotModel } from '../rendering/CharacterLoader';
import {
  resolveCharacterBone,
  resolveCharacterClip,
  TEAM_OPERATOR_CONFIG,
} from '../rendering/CharacterRig';
import { buildAmmoView, buildScoreboardView } from '../ui/hud/ScoreboardModel';
import { WEAPONS } from '../weapons/WeaponData';
import { roomManager, type RoomState, type NetworkPlayer } from '../networking/RoomManager';
import { MAP_MANIFEST, type TacticalMapDefinition } from '../maps/MapManifest';
import { MapBVH } from '../maps/MapBVH';
import { SpatialGrid } from '../maps/SpatialGrid';
import { extractTightSubColliders } from '../maps/MapLoader';

export default function Game() {
  const [webglError, setWebglError] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(true);
  const [menuState, setMenuState] = useState<'mode' | 'single-setup' | 'multi-home' | 'create' | 'join' | 'lobby'>('mode');
  const [username, setUsername] = useState('');
  const [chosenTeam, setChosenTeam] = useState<Team>('CT');
  const [roomCode, setRoomCode] = useState('');
  const [roomSettings, setRoomSettings] = useState({ teamSize: 5, maxRounds: 15, map: 'city' });
  const [mapName, setMapName] = useState('City Grid');
  const [mapRadarName, setMapRadarName] = useState('City');
  const [mapTagline, setMapTagline] = useState('Tactical FPS · City Grid · Round-Based 5v5');
  const loadMapRef = useRef<((id: string) => void) | null>(null);
  const [networkPlayers, setNetworkPlayers] = useState<NetworkPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('CONNECTING');
  const mapLoadedRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const hitmarkRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const damageRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const ctAliveRef = useRef<HTMLDivElement>(null);
  const tAliveRef = useRef<HTMLDivElement>(null);
  const ctScoreRef = useRef<HTMLSpanElement>(null);
  const tScoreRef = useRef<HTMLSpanElement>(null);
  const bombIconRef = useRef<HTMLDivElement>(null);
  const defuseRef = useRef<HTMLDivElement>(null);
  const defuseBarRef = useRef<HTMLDivElement>(null);
  const plantRef = useRef<HTMLDivElement>(null);
  const plantBarRef = useRef<HTMLDivElement>(null);
  const actionPromptRef = useRef<HTMLDivElement>(null);
  const hpRef = useRef<HTMLSpanElement>(null);
  const armorRef = useRef<HTMLSpanElement>(null);
  const moneyRef = useRef<HTMLSpanElement>(null);
  const weaponNameRef = useRef<HTMLDivElement>(null);
  const ammoRef = useRef<HTMLDivElement>(null);
  const ammoPrimaryRef = useRef<HTMLSpanElement>(null);
  const ammoReserveRef = useRef<HTMLElement>(null);
  const buyRef = useRef<HTMLDivElement>(null);
  const buyGridRef = useRef<HTMLDivElement>(null);
  const roundEndRef = useRef<HTMLDivElement>(null);
  const roundWinnerRef = useRef<HTMLDivElement>(null);
  const roundReasonRef = useRef<HTMLDivElement>(null);
  const killfeedRef = useRef<HTMLDivElement>(null);
  const playerTagRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const specBarRef = useRef<HTMLDivElement>(null);
  const roundHistRef = useRef<HTMLDivElement>(null);
  const scoreboardRef = useRef<HTMLDivElement>(null);
  const killstreakRef = useRef<HTMLDivElement>(null);
  const killstreakTextRef = useRef<HTMLDivElement>(null);
  const killstreakSubRef = useRef<HTMLDivElement>(null);
  const lowHpVignetteRef = useRef<HTMLDivElement>(null);
  const mvpCardRef = useRef<HTMLDivElement>(null);
  const mvpNameRef = useRef<HTMLDivElement>(null);
  const mvpReasonRef = useRef<HTMLDivElement>(null);
  // Game bridge refs — written before enterMatch, read by game loop
  const enterMatchRef = useRef<(() => void) | null>(null);
  const gameBridgeRef = useRef<any>(null);
  const playerTeamRef = useRef<Team>('CT');
  const playerNameRef = useRef<string>('Player');
  const isMultiplayerRef = useRef<boolean>(false);
  const isHostRef = useRef<boolean>(false);

  useEffect(() => {
    roomManager.init((id) => {
      setPeerId(id);
    });

    roomManager.onStateUpdate((networkState: RoomState) => {
      setNetworkPlayers(networkState.players);
      setRoomSettings(networkState.settings);
      setRoomCode(networkState.code);

      // Sync game logic state
      if (!isHost && gameBridgeRef.current) {
        gameBridgeRef.current.state.phase = networkState.phase;
        gameBridgeRef.current.state.phaseT = networkState.timer;
        gameBridgeRef.current.state.ctScore = networkState.score.CT;
        gameBridgeRef.current.state.tScore = networkState.score.T;
        gameBridgeRef.current.state.round = networkState.round;
        gameBridgeRef.current.state.attackSite = networkState.attackSite;
      }

      if (networkState.started && lobbyOpen) {
        handleEnterMatch(true);
      }
    });
  }, []);

  const activeMapId = 'city';

  useEffect(() => {
    if (loadMapRef.current) {
      loadMapRef.current(activeMapId);
    }
  }, [activeMapId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const dom = {
      game: containerRef.current, hud: hudRef.current!, crosshair: crosshairRef.current!,
      hitmark: hitmarkRef.current!, flash: flashRef.current!, damage: damageRef.current!,
      phase: phaseRef.current!, timer: timerRef.current!, ctAlive: ctAliveRef.current!,
      tAlive: tAliveRef.current!, ctScore: ctScoreRef.current!, tScore: tScoreRef.current!,
      bombIcon: bombIconRef.current!, defuse: defuseRef.current!, defuseBar: defuseBarRef.current!,
      plant: plantRef.current!, plantBar: plantBarRef.current!,
      actionPrompt: actionPromptRef.current!, hp: hpRef.current!, armor: armorRef.current!,
      money: moneyRef.current!, weaponName: weaponNameRef.current!, ammo: ammoRef.current!,
      ammoPrimary: ammoPrimaryRef.current!, ammoReserve: ammoReserveRef.current!,
      buy: buyRef.current!, buyGrid: buyGridRef.current!, roundEnd: roundEndRef.current!,
      roundWinner: roundWinnerRef.current!, roundReason: roundReasonRef.current!,
      killfeed: killfeedRef.current!, playerTag: playerTagRef.current!,
      minimap: minimapRef.current!, scope: scopeRef.current!,
      specBar: specBarRef.current!, roundHist: roundHistRef.current!,
      scoreboard: scoreboardRef.current!,
      killstreak: killstreakRef.current!, killstreakText: killstreakTextRef.current!,
      killstreakSub: killstreakSubRef.current!, lowHpVignette: lowHpVignetteRef.current!,
      mvpCard: mvpCardRef.current!, mvpName: mvpNameRef.current!, mvpReason: mvpReasonRef.current!
    };

    const clamp = (v: number, mn: number, mx: number) => Math.min(mx, Math.max(mn, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const rand = (mn: number, mx: number) => mn + Math.random() * (mx - mn);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const hspd = (v: THREE.Vector3) => Math.hypot(v.x, v.z);
    const scheduledTimeouts = new Set<number>();
    const scheduleTimeout = (callback: () => void, delayMs: number) => {
      const id = window.setTimeout(() => {
        scheduledTimeouts.delete(id);
        callback();
      }, delayMs);
      scheduledTimeouts.add(id);
      return id;
    };
    const clearScheduledTimeout = (timeoutId: number | undefined) => {
      if (timeoutId === undefined) return;
      scheduledTimeouts.delete(timeoutId);
      clearTimeout(timeoutId);
    };

    // ─── WEB AUDIO SOUND SYSTEM ──────────────────────────────────────────────
    const { playGunshot: _playGunshot, playHitSound: _playHitSound, playFootstep: _playFootstep, playLandSound: _playLandSound, playScopeToggle: _playScopeToggle, playBombPlant: _playBombPlant, updateBombBeep: _updateBombBeep, playBombExplode: _playBombExplode, playRoundStart: _playRoundStart, playDefuseSuccess: _playDefuseSuccess } = audioSystem;
    
    // Bind functions to preserve context and match existing code
    const playGunshot = (id: string) => audioSystem.playGunshot(id);
    const playHitSound = (headshot = false) => audioSystem.playHitSound(headshot);
    const playFootstep = (speedRatio = 1, walking = false) => audioSystem.playFootstep(speedRatio, walking);
    const playLandSound = (intensity = 1) => audioSystem.playLandSound(intensity);
    const playScopeToggle = (scoped: boolean) => audioSystem.playScopeToggle(scoped);
    const playBombPlant = () => audioSystem.playBombPlant();
    const updateBombBeep = (timer: number) => audioSystem.updateBombBeep(timer);
    const stopBombBeep = () => audioSystem.stopBombBeep();
    const playBombExplode = () => audioSystem.playBombExplode();
    const playRoundStart = () => audioSystem.playRoundStart();
    const playDefuseSuccess = () => audioSystem.playDefuseSuccess();
    const stopAmbience = () => audioSystem.stopAmbience();
    const unlockAudio = () => {
      try { audioSystem.unlock(); } catch {}
    };
    let gameRenderer: GameRenderer;
    try {
      gameRenderer = new GameRenderer(dom.game, dom.game.clientWidth, dom.game.clientHeight);
    } catch {
      setWebglError(true);
      return;
    }
    const renderer = gameRenderer.renderer;
    const scene = gameRenderer.scene;
    const camera = gameRenderer.camera;

    if (!renderer.getContext()) {
      setWebglError(true);
      gameRenderer.dispose();
      return;
    }

    const adaptiveQuality = new AdaptiveQualityController({
      initialPixelRatio: Math.min(devicePixelRatio, 1.75),
      minPixelRatio: 0.75,
      maxPixelRatio: Math.min(devicePixelRatio, 2),
      targetFps: 60,
      onTierChange: (tier) => {
        gameRenderer.setQualityTier(tier);
      },
    });
    gameRenderer.setPixelRatio(adaptiveQuality.pixelRatio);
    gameRenderer.setQualityTier(adaptiveQuality.qualityTier);
    scene.add(camera);

    // Expose core three.js objects for in-page debug overlay tooling
    try {
      (window as any).THREE = THREE;
      (window as any).__GAME_DEBUG__ = (window as any).__GAME_DEBUG__ || {};
      (window as any).__GAME_DEBUG__.scene = scene;
      (window as any).__GAME_DEBUG__.camera = camera;
      (window as any).__GAME_DEBUG__.renderer = renderer;
    } catch (e) {}

    const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x364048, 1.05);
    scene.add(hemi);
    const ambient = new THREE.AmbientLight(0xb2c2d0, 0.34);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffddb2, 2.35);
    sun.position.set(54, 58, 16); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 180;
    sun.shadow.bias = -0.001;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8ec7ff, 0.42);
    fill.position.set(-34, 26, -18); scene.add(fill);
    const back = new THREE.DirectionalLight(0xffba82, 0.24);
    back.position.set(18, 16, 36); scene.add(back);

    // Procedural sky
    const skyGeo = new THREE.SphereGeometry(180, 20, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color(0x6e90a8) }, mid: { value: new THREE.Color(0xe4b37c) }, bot: { value: new THREE.Color(0x666061) } },
      vertexShader: `varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 top,mid,bot;varying vec3 vW;void main(){float h=normalize(vW).y*.5+.5;vec3 c=mix(bot,mid,smoothstep(0.,.38,h));c=mix(c,top,smoothstep(.38,1.,h));gl_FragColor=vec4(c,1.);}`
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Shared graphics resources to prevent runtime allocation/lag when shooting/hitting
    const bloodGeo = new THREE.SphereGeometry(1, 6, 6);
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8b1515 });
    const impactGeo = new THREE.SphereGeometry(0.055, 7, 7);
    const impactMatDefault = new THREE.MeshBasicMaterial({ color: 0x27211c });
    const impactMatBot = new THREE.MeshBasicMaterial({ color: 0x33271d });
    const tracerPlayerMat = new THREE.LineBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.72 });
    const tracerPlayerScopedMat = new THREE.LineBasicMaterial({ color: 0xffe8aa, transparent: true, opacity: 0.72 });
    const tracerTMat = new THREE.LineBasicMaterial({ color: 0xffd59c, transparent: true, opacity: 0.72 });
    const tracerCTMat = new THREE.LineBasicMaterial({ color: 0x9ad7ff, transparent: true, opacity: 0.72 });

    const colliders: { min: THREE.Vector3; max: THREE.Vector3 }[] = [];
    const spatialGrid = new SpatialGrid(4);
    const mapBVH = new MapBVH();
    let debugCollidersGroup: THREE.Group | null = null;
    try { (window as any).__GAME_DEBUG__ = (window as any).__GAME_DEBUG__ || {}; (window as any).__GAME_DEBUG__.colliders = colliders; (window as any).__GAME_DEBUG__.spatialGrid = spatialGrid; (window as any).__GAME_DEBUG__.mapBVH = mapBVH; } catch (e) {}
    const bots: any[] = [];
    const droppedWeapons: any[] = [];
    let droppedBomb: { pos: THREE.Vector3; baseY: number } | null = null;
    let droppedBombMesh: THREE.Group | null = null;
    const tempV1 = new THREE.Vector3(), tempV2 = new THREE.Vector3();
    const tempBox = new THREE.Box3();
    const raycaster = new THREE.Raycaster();

    const viewModel = new THREE.Group(); viewModel.frustumCulled = false; camera.add(viewModel);
    let activeViewMuzzle: THREE.Object3D | null = null;
    let activeViewWeaponId = '';
    let activeViewTeam: Team = 'CT';

    const remotePlayers = new Map<string, { obj: THREE.Group, visualGroup: THREE.Group, body: THREE.Mesh, head: THREE.Object3D, weaponMount: THREE.Group, targetPos: THREE.Vector3, targetYaw: number, targetPitch: number, team: string, name: string, hp: number, weapon: string, mixer: THREE.AnimationMixer | null, actions: { idle: any, walk?: any, run: any }, currentAction: any }>();

    roomManager.onNetworkEvent((event) => {
      if (event.type === 'PLAYER_UPDATE') {
        const data = event.player;
        if (data.id === roomManager.getMyId()) return;
        
        let remote = remotePlayers.get(data.id);
        if (!remote) {
          const model = createBotModel((data.team === 'Spectator' ? 'CT' : data.team) as 'CT' | 'T', data.weapon);
          scene.add(model.group);
          const newRemote = { 
            obj: model.group, visualGroup: model.visualGroup, body: model.body, head: model.head, weaponMount: model.weaponMount,
            mixer: (model as any).mixer as THREE.AnimationMixer | null,
            actions: (model as any).actions,
            currentAction: (model as any).currentAction,
            targetPos: new THREE.Vector3(data.pos.x, data.pos.y - 1.55, data.pos.z),
            targetYaw: data.yaw, targetPitch: data.pitch,
            team: data.team, name: data.name, hp: data.hp, weapon: data.weapon
          };
          remotePlayers.set(data.id, newRemote);
          remote = newRemote;
        }

        if (remote) {
          remote.targetPos.set(data.pos.x, data.pos.y - 1.55, data.pos.z);
          remote.targetYaw = data.yaw;
          remote.targetPitch = data.pitch;
          remote.hp = data.hp;
          remote.weapon = data.weapon;
          
          if (remote.hp <= 0 && remote.obj.visible) remote.obj.visible = false;
          else if (remote.hp > 0 && !remote.obj.visible) remote.obj.visible = true;
        }
      } else if (event.type === 'DAMAGE') {
        const myId = roomManager.getMyId() || '';
        if (event.targetId === myId) {
          // I was hit
          player.hp -= event.damage;
          showDamage();
          if (player.hp <= 0 && player.alive) {
            player.alive = false;
            player.deaths++;
            
            const killer = event.killerId === myId ? { name: playerNameRef.current, team: player.team } 
              : remotePlayers.get(event.killerId) || { name: 'Unknown', team: 'CT' };
            addKillfeed(killer, player, event.weapon);
          }
        } else {
          // Someone else was hit
          const remote = remotePlayers.get(event.targetId);
          if (remote) {
            remote.hp -= event.damage;
            spawnBlood(remote.obj.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
            if (remote.hp <= 0 && remote.obj.visible) {
               remote.obj.visible = false;
               const killer = event.killerId === myId ? { name: playerNameRef.current, team: player.team } 
                 : remotePlayers.get(event.killerId) || { name: 'Unknown', team: 'CT' };
               addKillfeed(killer, remote, event.weapon);
            }
          }
        }
      }
    });

    function updateRemotePlayers(dt: number) {
      remotePlayers.forEach((remote) => {
        // Linear interpolation for smooth movement
        const spd = remote.obj.position.distanceTo(remote.targetPos);
        remote.obj.position.lerp(remote.targetPos, 0.15);
        
        // Simple angle lerp
        const angleDiff = remote.targetYaw - remote.obj.rotation.y;
        remote.obj.rotation.y += angleDiff * 0.2;
        
        const pitchDiff = remote.targetPitch - remote.head.rotation.x;
        remote.head.rotation.x += pitchDiff * 0.2;

        if (remote.mixer) remote.mixer.update(dt);
        syncAnimation(remote, spd / dt, dt);
      });
    }

    function createWeaponMaterialSet() {
      return {
        gunMetal: new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.78, roughness: 0.28 }),
        gunSteel: new THREE.MeshStandardMaterial({ color: 0x7a8390, metalness: 0.88, roughness: 0.18 }),
        gunPoly:  new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.2, roughness: 0.58 }),
        gunWood:  new THREE.MeshStandardMaterial({ color: 0x6b4422, roughness: 0.72, metalness: 0.06 }),
        gunTan:   new THREE.MeshStandardMaterial({ color: 0x706048, roughness: 0.65, metalness: 0.1 }),
        optic:    new THREE.MeshStandardMaterial({ color: 0x16191f, metalness: 0.55, roughness: 0.28 }),
        lens:     new THREE.MeshStandardMaterial({ color: 0x103050, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.7 }),
        brass:    new THREE.MeshStandardMaterial({ color: 0xb8882e, metalness: 0.85, roughness: 0.2 }),
      };
    }

    function shadowify(obj: THREE.Object3D) {
      obj.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; (c as THREE.Mesh).receiveShadow = true; } });
      return obj;
    }

    function addMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x=0, y=0, z=0, rx=0, ry=0, rz=0) {
      const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.rotation.set(rx,ry,rz); parent.add(m); return m;
    }

    // ─── WEAPON MODELS ──────────────────────────────────────────────────────────
    function makeHands(team: Team) {
      const g = new THREE.Group();
      const palette = getTeamVisualPalette(team);
      const skin = new THREE.MeshStandardMaterial({ color: palette.skinColor, roughness: 0.9 });
      const glove = new THREE.MeshStandardMaterial({ color: palette.gloveColor, roughness: 0.85 });
      const gloveDark = new THREE.MeshStandardMaterial({ color: palette.gloveDarkColor, roughness: 0.88 });
      const sleeve = new THREE.MeshStandardMaterial({ color: palette.sleeveColor, roughness: 0.82, metalness: 0.04 });
      const sleeveDark = new THREE.MeshStandardMaterial({ color: palette.sleeveDarkColor, roughness: 0.86, metalness: 0.03 });
      const brass = new THREE.MeshStandardMaterial({ color: 0xb8882e, metalness: 0.85, roughness: 0.2 });
      // Left hand
      addMesh(g, new THREE.BoxGeometry(0.09,0.13,0.22), glove,   -0.16,-0.21,-0.14, 0.18,0,-0.18);
      addMesh(g, new THREE.BoxGeometry(0.07,0.07,0.15), gloveDark,  -0.16,-0.24,-0.04, 0.48,0,-0.18);
      addMesh(g, new THREE.BoxGeometry(0.085,0.07,0.14), sleeve, -0.16,-0.275,0.015, 0.52,0,-0.16);
      addMesh(g, new THREE.BoxGeometry(0.07,0.04,0.11), sleeveDark, -0.16,-0.305,0.06, 0.48,0,-0.12);
      addMesh(g, new THREE.CylinderGeometry(0.014,0.016,0.12,8), brass, -0.15,-0.16,-0.02, 0,0,0.4);
      // Right hand
      addMesh(g, new THREE.BoxGeometry(0.09,0.13,0.22), glove,    0.16,-0.21,-0.14, 0.18,0, 0.18);
      addMesh(g, new THREE.BoxGeometry(0.07,0.07,0.15), gloveDark,   0.16,-0.24,-0.04, 0.48,0, 0.18);
      addMesh(g, new THREE.BoxGeometry(0.085,0.07,0.14), sleeve, 0.16,-0.275,0.015, 0.52,0,0.16);
      addMesh(g, new THREE.BoxGeometry(0.07,0.04,0.11), sleeveDark, 0.16,-0.305,0.06, 0.48,0,0.12);
      // fingers stub
      for (let s of [-1,1]) {
        addMesh(g, new THREE.BoxGeometry(0.018,0.06,0.04), skin, s*0.12,-0.18,-0.27, 0.3,0,s*0.05);
        addMesh(g, new THREE.BoxGeometry(0.018,0.06,0.04), skin, s*0.16,-0.17,-0.28, 0.28,0,0);
        addMesh(g, new THREE.BoxGeometry(0.018,0.06,0.04), skin, s*0.20,-0.18,-0.27, 0.3,0,-s*0.05);
      }
      return g;
    }



    const minimapWalls: {x:number,z:number,w:number,d:number}[] = [];

    // Floor
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(140,140), new THREE.MeshStandardMaterial({ color:0xb09870, roughness:0.98, metalness:0.02 }));
    floorMesh.rotation.x = -Math.PI/2; floorMesh.receiveShadow = true; scene.add(floorMesh);

    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    gltfLoader.setDRACOLoader(dracoLoader);

    const characterCache = new Map<string, { scene: THREE.Group, animations: THREE.AnimationClip[] }>();

    function prepLoadedMapAsset(root: THREE.Object3D) {
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (!mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          if ('map' in mat && (mat as any).map) {
            (mat as any).map.colorSpace = THREE.SRGBColorSpace;
          }
          mat.needsUpdate = true;
        }
      });
    }

    let A_SITE = vec(-30,4.65,-10);
    let B_SITE = vec(30,4.65,-18);
    let CT_SPAWN_POS = vec(24,4.65,28);
    let T_SPAWN_POS = vec(-24,4.65,-36);

    const siteMarkersGroup = new THREE.Group();
    scene.add(siteMarkersGroup);

    let cityGroup: THREE.Group | null = null;


    function siteMarker(label:string,x:number,z:number,col:string) {
      const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;
      ctx.fillStyle='rgba(20,16,10,0.22)';ctx.beginPath();ctx.arc(128,128,112,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=col;ctx.lineWidth=14;ctx.beginPath();ctx.arc(128,128,90,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle=col;ctx.font='bold 130px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,128,140);
      const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
      const m=new THREE.Mesh(new THREE.PlaneGeometry(5.5,5.5),new THREE.MeshStandardMaterial({map:t,transparent:true,opacity:0.82,depthWrite:false}));
      m.rotation.x=-Math.PI/2;m.position.set(x,CT_SPAWN_POS.y+0.02,z);siteMarkersGroup.add(m);
    }

    async function processCityModel(city: THREE.Group, mapDef: TacticalMapDefinition) {
      if (!city) return;
      setLoadingStatus('PREPARING GEOMETRY');
      prepLoadedMapAsset(city);
      const b3 = new THREE.Box3().setFromObject(city);
      const size = b3.getSize(new THREE.Vector3());
      const scaleFactor = 140 / (Math.max(size.x, size.z) || 1);
      console.log("GLTF ORIGINAL SIZE:", size.x, size.y, size.z);
      console.log("COMPUTED SCALE FACTOR:", scaleFactor);
      city.scale.setScalar(scaleFactor);
      b3.setFromObject(city); const center = b3.getCenter(new THREE.Vector3());
      console.log("GLTF CENTERED CENTER:", center.x, center.y, center.z);
      console.log("GLTF B3 MIN/MAX:", b3.min.x, b3.min.y, b3.min.z, "MAX:", b3.max.x, b3.max.y, b3.max.z);
      city.position.x -= center.x; city.position.z -= center.z; city.position.y -= b3.min.y;
      scene.add(city);

      // CRITICAL: Update city's world matrix immediately so that bounding boxes
      // and getWorldPosition of spawn nodes are computed with the correct scale and position
      city.updateMatrixWorld(true);

      // Extract authored metadata points (world-space) if present in the GLTF
      let foundSpawnCT = false, foundSpawnT = false, foundSiteA = false, foundSiteB = false;
      city.traverse((child) => {
        const name = (child as THREE.Object3D).name || '';
        if (!name) return;
        const wp = new THREE.Vector3();
        (child as THREE.Object3D).getWorldPosition(wp);
        if (name === 'Spawn_CT') { CT_SPAWN_POS.copy(wp); foundSpawnCT = true; }
        if (name === 'Spawn_T') { T_SPAWN_POS.copy(wp); foundSpawnT = true; }
        if (name === 'Site_A') { A_SITE.copy(wp); foundSiteA = true; }
        if (name === 'Site_B') { B_SITE.copy(wp); foundSiteB = true; }
      });

      const meshes: THREE.Mesh[] = [];
      city.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).geometry.computeBoundingBox(); meshes.push(o as THREE.Mesh); } });
      
      setLoadingStatus('BUILDING PHYSICS');
      mapBVH.buildFromScene(city);

      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i];
        if (!mesh.geometry.boundingBox) continue;
        
        const name = (mesh.name || '').toLowerCase();
        const isExcluded = 
          name.includes('road') || 
          name.includes('line') || 
          name.includes('panchina') || 
          name.includes('seemaforo') || 
          name.includes('cartello') || 
          name.includes('divieto') || 
          name.includes('cespuglio') ||
          name.includes('sky') ||
          name.includes('dome');

        if (isExcluded) continue;

        const subBoxes = extractTightSubColliders(mesh);
        for (const box of subBoxes) {
          colliders.push(box);
          spatialGrid.insert(box);
          const sizeX = box.max.x - box.min.x;
          const sizeZ = box.max.z - box.min.z;
          minimapWalls.push({ x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, w: sizeX, d: sizeZ });
        }
      }

      const isDebugColliders = typeof window !== 'undefined' && window.location.search.includes('debugColliders=1');
      if (isDebugColliders) {
        debugCollidersGroup = new THREE.Group();
        debugCollidersGroup.name = 'DebugCollidersGroup';
        for (const c of colliders) {
          const boxGeo = new THREE.BoxGeometry(c.max.x - c.min.x, c.max.y - c.min.y, c.max.z - c.min.z);
          const boxMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
          const boxMesh = new THREE.Mesh(boxGeo, boxMat);
          boxMesh.position.set((c.min.x + c.max.x) / 2, (c.min.y + c.max.y) / 2, (c.min.z + c.max.z) / 2);
          debugCollidersGroup.add(boxMesh);
        }
        scene.add(debugCollidersGroup);
      }

      // If the GLTF did not include authored spawn/site nodes, fall back to the mapDef entry
      try {
        const toWorld = (pos: [number, number, number]) => {
          // Manifest positions are already in world-space
          return new THREE.Vector3(pos[0], pos[1], pos[2]);
        };

        if (!foundSpawnCT) {
          const s = mapDef.spawns.find((p) => p.team === 'CT');
          if (s) CT_SPAWN_POS.copy(toWorld(s.position));
        }
        if (!foundSpawnT) {
          const s = mapDef.spawns.find((p) => p.team === 'T');
          if (s) T_SPAWN_POS.copy(toWorld(s.position));
        }

        if (!foundSiteA) {
          const a = mapDef.bombSites.find((b) => b.id === 'A');
          if (a) A_SITE.copy(toWorld(a.position));
        }
        if (!foundSiteB) {
          const b = mapDef.bombSites.find((b) => b.id === 'B');
          if (b) B_SITE.copy(toWorld(b.position));
        }
      } catch (e) {
        console.warn("Manifest fallback failed:", e);
      }




      // Place site markers now that authored positions are known
      siteMarker('A', A_SITE.x, A_SITE.z, '#dc8a66');
      siteMarker('B', B_SITE.x, B_SITE.z, '#dc8a66');

      setLoadingStatus('READY');
      setLoadingProgress(100);
      try {
        (player as any).pos.set(CT_SPAWN_POS.x, CT_SPAWN_POS.y + EYE, CT_SPAWN_POS.z);
      } catch (e) {}

      try {
        (window as any).__MAP_DEBUG__ = {
          ctSpawn: CT_SPAWN_POS.clone(),
          tSpawn: T_SPAWN_POS.clone(),
          aSite: A_SITE.clone(),
          bSite: B_SITE.clone(),
          collidersCount: colliders.length,
          colliders: colliders.map(c => ({ min: { x: c.min.x, y: c.min.y, z: c.min.z }, max: { x: c.max.x, y: c.max.y, z: c.max.z } })),
        };
        (window as any).__BLOCKED_AT__ = (x: number, z: number, r = 0.42) => {
          const mnX = x - r, mxX = x + r, mnZ = z - r, mxZ = z + r;
          for (const c of colliders) {
            const h = c.max.y - c.min.y;
            if (c.max.y > 0.7 && h > 0.48) {
              if (mnX < c.max.x && mxX > c.min.x && mnZ < c.max.z && mxZ > c.min.z) return true;
            }
          }
          return false;
        };
      } catch (e) {}

      // Generate Navigation Graph for pathfinding
      try {
        const nodes: NavNode[] = [];
        const spacing = 3.5;
        
        // 1. Generate walkable nodes
        for (let x = -56; x <= 56; x += spacing) {
          for (let z = -56; z <= 56; z += spacing) {
            if (!blockedAt(x, z, 0.46)) {
              const id = `n_${x.toFixed(1)}_${z.toFixed(1)}`;
              const pos = { x, y: CT_SPAWN_POS.y, z };
              nodes.push({
                id,
                position: pos,
                connections: [],
                coverScore: 0.5,
                siteProximity: {
                  A: distanceVec3(pos, A_SITE),
                  B: distanceVec3(pos, B_SITE),
                }
              });
            }
          }
        }

        // 2. Connect neighbor nodes
        const maxConnectDist = spacing * 1.45;
        for (let i = 0; i < nodes.length; i++) {
          const nodeA = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const nodeB = nodes[j];
            const dist = distanceVec3(nodeA.position, nodeB.position);
            if (dist <= maxConnectDist) {
              const startVec = new THREE.Vector3(nodeA.position.x, nodeA.position.y, nodeA.position.z);
              const endVec = new THREE.Vector3(nodeB.position.x, nodeB.position.y, nodeB.position.z);
              if (lineClear2D(startVec, endVec, 0.42)) {
                nodeA.connections.push(nodeB.id);
                nodeB.connections.push(nodeA.id);
              }
            }
          }
        }

        navGraph = buildNavGraph(nodes);
        console.log(`[NAV] Generated NavGraph with ${nodes.length} nodes and ${navGraph.chokepoints.size} chokepoints.`);
      } catch (err) {
        console.warn("Failed to generate nav graph:", err);
      }

      setMapLoaded(true); mapLoadedRef.current = true;
    }

    async function loadSelectedMap(mapId: string) {
      setMapLoaded(false);
      mapLoadedRef.current = false;
      setLoadingStatus('LOADING MAP...');
      setLoadingProgress(0);

      // Clean up previous map group
      if (cityGroup) {
        scene.remove(cityGroup);
        disposeObject3DResources(cityGroup);
        cityGroup = null;
      }
      if (debugCollidersGroup) {
        scene.remove(debugCollidersGroup);
        disposeObject3DResources(debugCollidersGroup);
        debugCollidersGroup = null;
      }

      // Clear colliders and spatial grid
      colliders.length = 0;
      minimapWalls.length = 0;
      spatialGrid.clear();
      mapBVH.dispose();

      // Clear site markers
      while (siteMarkersGroup.children.length > 0) {
        const child = siteMarkersGroup.children[0];
        siteMarkersGroup.remove(child);
        disposeObject3DResources(child);
      }



      const mapDef = MAP_MANIFEST.maps.find(m => m.id === mapId) || MAP_MANIFEST.maps[0];
      
      // Update metadata states
      setMapName(mapDef.name);
      setMapRadarName(mapDef.name.split(' ')[0] || mapDef.name);
      setMapTagline(`Tactical FPS · ${mapDef.name} · Round-Based 5v5`);

      // Set baseline values from the manifest
      const ctSpawnDef = mapDef.spawns.find(s => s.team === 'CT');
      if (ctSpawnDef) CT_SPAWN_POS.set(ctSpawnDef.position[0], ctSpawnDef.position[1], ctSpawnDef.position[2]);
      const tSpawnDef = mapDef.spawns.find(s => s.team === 'T');
      if (tSpawnDef) T_SPAWN_POS.set(tSpawnDef.position[0], tSpawnDef.position[1], tSpawnDef.position[2]);

      const siteADef = mapDef.bombSites.find(s => s.id === 'A');
      if (siteADef) A_SITE.set(siteADef.position[0], siteADef.position[1], siteADef.position[2]);
      const siteBDef = mapDef.bombSites.find(s => s.id === 'B');
      if (siteBDef) B_SITE.set(siteBDef.position[0], siteBDef.position[1], siteBDef.position[2]);

      const mapUrl = `${mapDef.assetRoot}${mapDef.id}.glb`;
      setLoadingStatus('DOWNLOADING MAP');
      gltfLoader.load(mapUrl, (gltf) => {
        cityGroup = gltf.scene;
        processCityModel(cityGroup, mapDef);
      }, (p) => {
        if (p.total) setLoadingProgress(Math.min(20, Math.round((p.loaded / p.total) * 20)));
        else setLoadingProgress(10);
      }, (e) => {
        console.error("Failed to load map asset:", e);
        setLoadingStatus('MAP LOAD FAILED');
        setMapLoaded(true); mapLoadedRef.current = true;
      });
    }

    loadMapRef.current = loadSelectedMap;

    loadSelectedMap(activeMapId);

    // Safety timeout: If map isn't ready in 20s, force proceed with fallback floor
    scheduleTimeout(() => {
      if (!mapLoadedRef.current) {
        console.warn("Map load timeout. Using emergency floor.");
        setLoadingStatus('BOOTING EMERGENCY WORLD');
        setMapLoaded(true); mapLoadedRef.current = true;
      }
    }, 20000);

    // ─── WEAPONS ────────────────────────────────────────────────────────────────
    // Using WEAPONS from WeaponData.ts

    const BUY_ITEMS_CT = [
      {type:'weapon',id:'usp',   label:'USP-S SIDEARM',  key:'1'},
      {type:'weapon',id:'deagle',label:'DESERT EAGLE',   key:'2'},
      {type:'weapon',id:'mp9',   label:'MP9 SMG',        key:'3'},
      {type:'weapon',id:'m4a1',  label:'M4A1-S RIFLE',   key:'4'},
      {type:'weapon',id:'awp',   label:'AWP SNIPER',     key:'5'},
      {type:'gear',  id:'kevlar',label:'KEVLAR',         price:650,  key:'6'},
      {type:'gear',  id:'helmet',label:'HELMET + KEVLAR',price:1000, key:'7'},
      {type:'gear',  id:'kit',   label:'DEFUSE KIT',     price:400,  key:'8'},
      {type:'gear',  id:'ammo',  label:'FULL AMMO REFILL',price:180, key:'9'},
    ];
    const BUY_ITEMS_T = [
      {type:'weapon',id:'glock', label:'GLOCK-18 SIDEARM',key:'1'},
      {type:'weapon',id:'deagle',label:'DESERT EAGLE',    key:'2'},
      {type:'weapon',id:'mac10', label:'MAC-10 SMG',      key:'3'},
      {type:'weapon',id:'ak47',  label:'AK-47 RIFLE',     key:'4'},
      {type:'weapon',id:'awp',   label:'AWP SNIPER',      key:'5'},
      {type:'gear',  id:'kevlar',label:'KEVLAR',          price:650,  key:'6'},
      {type:'gear',  id:'helmet',label:'HELMET + KEVLAR', price:1000, key:'7'},
      {type:'gear',  id:'ammo',  label:'FULL AMMO REFILL',price:180, key:'8'},
    ];
    const BUY_ITEMS = () => player.team === 'T' ? BUY_ITEMS_T : BUY_ITEMS_CT;

    const PLAYER_HEIGHT = 1.72, CROUCH_HEIGHT = 1.34, EYE = 1.55;
    // Find a safe spawn location near `spawn` that does not intersect colliders.
    function findSafeSpawn(spawn: THREE.Vector3, eyeH: number) {
      const r = 0.34; // player horizontal radius used by collisions
      const startY = (spawn.y || 0) + eyeH;

      // helper to test overlap at given x,y,z
      const overlaps = (x: number, y: number, z: number) => {
        const mn = new THREE.Vector3(x - r, y - eyeH, z - r);
        const mx = new THREE.Vector3(x + r, y + 0.1, z + r);
        for (const c of colliders) {
          if (mn.x < c.max.x && mx.x > c.min.x && mn.y < c.max.y && mx.y > c.min.y && mn.z < c.max.z && mx.z > c.min.z) {
            return true;
          }
        }
        return false;
      };

      // Try vertical lifts first
      for (let dy = 0; dy <= 6; dy += 0.25) {
        const y = startY + dy;
        if (!overlaps(spawn.x, y, spawn.z)) return new THREE.Vector3(spawn.x, y, spawn.z);
      }

      // Try radial offsets (spiral)
      const radii = [0.5, 1.0, 1.6, 2.4];
      for (const rad of radii) {
        for (let a = 0; a < 360; a += 45) {
          const ang = (a * Math.PI) / 180;
          const x = spawn.x + Math.cos(ang) * rad;
          const z = spawn.z + Math.sin(ang) * rad;
          for (let dy = 0; dy <= 3.0; dy += 0.25) {
            const y = startY + dy;
            if (!overlaps(x, y, z)) return new THREE.Vector3(x, y, z);
          }
        }
      }

      // Fallback: place on top of the highest collider under spawn
      let highest = -Infinity;
      for (const c of colliders) {
        if (spawn.x >= c.min.x - r && spawn.x <= c.max.x + r && spawn.z >= c.min.z - r && spawn.z <= c.max.z + r) {
          highest = Math.max(highest, c.max.y);
        }
      }
      const y = (highest === -Infinity ? startY : highest + eyeH + 0.05);
      return new THREE.Vector3(spawn.x, y, spawn.z);
    }
    const player: any = {
      pos: vec(CT_SPAWN_POS.x,CT_SPAWN_POS.y + EYE,CT_SPAWN_POS.z), vel: new THREE.Vector3(), onGround:true, crouch:false, walking:false,
      yaw:0, pitch:0, hp:100, armor:0, helmet:false, hasKit:false, money:800,
      inventory:{knife:'knife',sidearm:'usp',primary:null}, ammo:{}, weapon:'usp',
      scoped:false, reloading:false, reloadT:0, reloadWeapon:null, shootCD:0,
      recoilIdx:0, alive:true, team:'CT', hasBomb:false, jumpLock:false, jumpBuffer:0, landBob:0, switchBob:1,
      stepNoiseCd:0,
      kills:0, deaths:0, roundKills:0, roundHeadshots:0,
      inspecting: false, inspectT: 0,
      shooting: false,
      mixer: null as THREE.AnimationMixer | null,
      actions: { idle: null, walk: null, run: null },
      currentAction: null,
      timeSinceStationary: 0,
      timeSinceJump: 0,
      cameraPunch: 0,
    };
    try { (window as any).__GAME_DEBUG__ = (window as any).__GAME_DEBUG__ || {}; (window as any).__GAME_DEBUG__.player = player; } catch (e) {}
    const state: any = {
      started:false, round:1, ctScore:0, tScore:0, maxRounds:15,
      phase:'freeze', phaseT:0, frozenRoundTime:0, bomb:null, buyOpen:false, defusingT:0, attackSite:'A', matchOver:false,
      ctLossStreak:0, tLossStreak:0, roundHistory:[] as {winner:string}[],
      specTarget:null as any, specIdx:0, scoreboardOpen:false,
    };
    gameBridgeRef.current = { state };
    let soundEvents: AudibleEvent[] = [];
    let mouseVelX = 0;
    let mouseVelY = 0;
    let navGraph: NavGraph | null = null;
    const persistentBotStats = new Map<string, { kills: number, deaths: number, money: number }>();

    function emitSoundEvent(team: Team | 'neutral', position: THREE.Vector3, kind: AudibleEvent['kind'], loudness: number) {
      soundEvents.push({
        team,
        kind,
        age: 0,
        loudness,
        position: { x: position.x, y: position.y, z: position.z },
      });
    }

    function updateSoundEvents(dt: number) {
      soundEvents = advanceAudibleEvents(soundEvents, dt);
    }

    function activeWeapon() { return WEAPONS[player.weapon]; }
    function ensureAmmo(id:string,mag?:number,rsv?:number) {
      if(!player.ammo[id]) player.ammo[id]={mag:mag??WEAPONS[id].magSize,reserve:rsv??WEAPONS[id].reserve,magSize:WEAPONS[id].magSize};
      return player.ammo[id];
    }
    function ammoFor(id:string){ return player.ammo[id]||ensureAmmo(id); }
    ensureAmmo('usp');
    function cancelReload(){ player.reloading=false;player.reloadT=0;player.reloadWeapon=null; }

    // ─── VIEW MODEL ─────────────────────────────────────────────────────────────
    function rebuildViewModelFor(weaponId: string, team: Team){
      while(viewModel.children.length) {
        const child = viewModel.children[0];
        viewModel.remove(child);
        disposeObject3DResourcesWithOptions(child, { disposeTextureMaps: false });
      }
      const pack=createWeaponModel(weaponId,'view', team);
      viewModel.add(pack.group); activeViewMuzzle=pack.muzzle;
      activeViewWeaponId = weaponId;
      activeViewTeam = team;
      viewModel.visible = true;
    }
    function rebuildViewModel(){
      rebuildViewModelFor(player.weapon, player.team);
    }
    function syncViewModel(weaponId: string, team: Team) {
      if (activeViewWeaponId === weaponId && activeViewTeam === team) return;
      rebuildViewModelFor(weaponId, team);
    }
    rebuildViewModel();

    function equipWeapon(id:string){
      if(!id||!WEAPONS[id]) return;
      player.weapon=id;player.scoped=false;cancelReload();
      player.recoilIdx=0;player.switchBob=0;player.shootCD=Math.max(player.shootCD,0.08);
      rebuildViewModel();updateHUD();
    }
    function equipSlot(slot:string){ const id=slot==='knife'?'knife':player.inventory[slot]; if(id) equipWeapon(id); }
    function grantWeapon(id:string){ const w=WEAPONS[id];if(!w||w.slot==='knife')return;player.inventory[w.slot]=id;ensureAmmo(id);equipWeapon(id); }

    // ─── DROPPED WEAPONS ────────────────────────────────────────────────────────
    function createDroppedWeapon(id:string,pos:THREE.Vector3,mag=WEAPONS[id].magSize,rsv=WEAPONS[id].reserve, baseY?: number){
      const pack=createWeaponModel(id,'world');
      const base=new THREE.Group();
      pack.group.rotation.set(Math.PI/2,0.2+Math.random()*0.3,Math.PI/2+rand(-0.3,0.3));
      base.add(pack.group);
      const ring=new THREE.Mesh(new THREE.RingGeometry(0.18,0.26,24),new THREE.MeshBasicMaterial({color:0xe8c36a,transparent:true,opacity:0.5,side:THREE.DoubleSide}));
      ring.rotation.x=-Math.PI/2;ring.position.y=-0.11;base.add(ring);
      const actualBaseY = baseY !== undefined ? baseY : pos.y;
      base.position.copy(pos);base.position.y=actualBaseY + 0.16;shadowify(base);scene.add(base);
      const e={id,group:base,ring,ammoMag:mag,ammoReserve:rsv,bobSeed:Math.random()*Math.PI*2, baseY: actualBaseY};
      droppedWeapons.push(e);return e;
    }
    function removeDroppedWeapon(e:any){
      const i=droppedWeapons.indexOf(e);
      if(i>=0)droppedWeapons.splice(i,1);
      scene.remove(e.group);
      disposeObject3DResourcesWithOptions(e.group, { disposeTextureMaps: false });
    }
    function nearestDroppedWeapon(){ let best:any=null,bd=1.8;for(const d of droppedWeapons){const dd=player.pos.distanceTo(d.group.position);if(dd<bd){bd=dd;best=d;}}return best; }
    function dropCurrentWeapon(){
      const w=activeWeapon();if(!player.alive||w.slot==='knife')return;
      const id=player.inventory[w.slot];if(!id)return;
      const ammo=ammoFor(id);
      const playerFootY = player.pos.y - EYE;
      createDroppedWeapon(id,player.pos.clone().add(getCameraDir().setY(0).normalize().multiplyScalar(0.8)),ammo.mag,ammo.reserve, playerFootY);
      player.inventory[w.slot]=null;
      if(player.weapon===id) equipWeapon(player.inventory.primary||player.inventory.sidearm||'knife');
    }
    function pickupWeapon(e:any){
      const w=WEAPONS[e.id];if(!w||w.slot==='knife')return;
      const cur=player.inventory[w.slot];
      if(cur===e.id){ const a=ammoFor(e.id);a.mag=Math.max(a.mag,e.ammoMag);a.reserve=Math.max(a.reserve,e.ammoReserve);removeDroppedWeapon(e);updateHUD();return; }
      if(cur){ const ea=ammoFor(cur);const playerFootY = player.pos.y - EYE; createDroppedWeapon(cur,player.pos.clone().add(getCameraDir().setY(0).normalize().multiplyScalar(0.8)),ea.mag,ea.reserve, playerFootY); }
      player.inventory[w.slot]=e.id;player.ammo[e.id]={mag:e.ammoMag,reserve:e.ammoReserve,magSize:w.magSize};
      removeDroppedWeapon(e);equipWeapon(e.id);
    }

    // ─── BUY MENU ───────────────────────────────────────────────────────────────
    function buildBuyMenu(){
      dom.buyGrid.replaceChildren();
      for(const item of BUY_ITEMS()){
        const price=item.type==='weapon'?WEAPONS[item.id].price:(item as any).price;
        const btn=document.createElement('button');btn.className='game-buybtn';
        const owned=item.type==='weapon'&&player.inventory[WEAPONS[item.id].slot]===item.id;
        const labelWrap = document.createElement('span');
        const key = document.createElement('span');
        key.className = 'game-key';
        key.textContent = `[${item.key}]`;
        labelWrap.append(key, `${item.label}${owned ? ' · OWNED' : ''}`);
        const priceLabel = document.createElement('span');
        priceLabel.className = 'game-price';
        priceLabel.textContent = `$${price}`;
        btn.append(labelWrap, priceLabel);
        btn.disabled=player.money<price;btn.onclick=()=>buyItem(item);dom.buyGrid.appendChild(btn);
      }
    }
    function buyItem(item:any){
      const price=item.type==='weapon'?WEAPONS[item.id].price:item.price;
      if(player.money<price)return;player.money-=price;
      if(item.type==='weapon') grantWeapon(item.id);
      else if(item.id==='kevlar') player.armor=Math.max(player.armor,100);
      else if(item.id==='helmet'){player.armor=100;player.helmet=true;}
      else if(item.id==='kit') player.hasKit=true;
      else if(item.id==='ammo'){
        if(player.inventory.sidearm){const w=WEAPONS[player.inventory.sidearm];ammoFor(player.inventory.sidearm).reserve=w.reserve;}
        if(player.inventory.primary){const w=WEAPONS[player.inventory.primary];ammoFor(player.inventory.primary).reserve=w.reserve;}
      }
      buildBuyMenu();updateHUD();
    }
    function setBuyOpen(open:boolean){
      if(state.phase!=='freeze')open=false;
      state.buyOpen=open;dom.buy.style.display=open?'block':'none';
      if(open){buildBuyMenu();document.exitPointerLock();}
      else if(state.started&&player.alive) requestAimLock();
    }

    const createBotModelHelper = (team: string, weaponId: string) => createBotModel(team, weaponId, gltfLoader);

    // ─── BOT SYSTEM ─────────────────────────────────────────────────────────────
    function botLoadout(team:string){
      if(state.round===1) return team==='CT'?(Math.random()<0.24?'deagle':'usp'):'glock';
      const roll=Math.random();
      if(team==='CT'){ if(state.round>4&&roll<0.16)return'awp';if(roll<0.38)return'mp9';return'm4a1'; }
      if(state.round>4&&roll<0.12)return'awp';if(roll<0.3)return'mac10';return'ak47';
    }

    function botDifficulty(): BotDifficulty {
      if(state.round >= 10) return 'pro';
      if(state.round >= 5) return 'hard';
      if(state.round >= 2) return 'medium';
      return 'easy';
    }

    function makeBot(team:string,pos:THREE.Vector3,name:string,role:string){
      // Get/Initialize persistent stats
      const stats = persistentBotStats.get(name) || { kills: 0, deaths: 0, money: 800 };
      persistentBotStats.set(name, stats);

      // Determine team economy
      const streak = team === 'CT' ? state.ctLossStreak : state.tLossStreak;
      let shouldFullSave = false;
      let isEcoRound = false;
      if (state.round === 1) {
        isEcoRound = true;
      } else if (streak >= 2 && Math.random() < 0.5) {
        shouldFullSave = true;
      } else if (streak >= 1 && Math.random() < 0.6) {
        isEcoRound = true;
      }
      
      const teamEco: TeamEconomy = {
        shouldFullSave,
        isEcoRound,
        averageTeamMoney: shouldFullSave ? 1000 : isEcoRound ? 2000 : 5000,
      };

      const plan = getBotPurchasePlan(stats.money, team as 'CT' | 'T', teamEco, state.round);
      
      // Deduct weapon and armor costs
      let cost = 0;
      if (plan.weapon !== 'knife') {
        const weaponPrice = WEAPONS[plan.weapon]?.price ?? 200;
        cost += weaponPrice;
      }
      if (plan.armor) cost += 650;
      if (plan.helmet) cost += 350;
      stats.money = Math.max(0, stats.money - cost);

      const weaponId = plan.weapon === 'knife' ? (team === 'CT' ? 'usp' : 'glock') : plan.weapon;
      const profile = createBotProfile(botDifficulty(), Math.random());
      const model = createBotModel(team, weaponId, gltfLoader);
      model.group.position.copy(pos); scene.add(model.group);
      return {
        id: 'bot-' + Math.random().toString(36).substr(2, 9),
        obj:model.group, visualGroup: model.visualGroup, body:model.body, head:model.head, weaponMount:model.weaponMount,
        mixer: (model as any).mixer as THREE.AnimationMixer | null,
        team, name, role, hp:100, armor:plan.armor ? 100 : 0, helmet:plan.helmet,
        alive:true, weapon:weaponId, ammoMag:WEAPONS[weaponId].magSize, reloadT:0,
        kills:stats.kills, deaths:stats.deaths, money:stats.money,
        difficulty:profile.difficulty,
        fireCD:rand(0.1,0.35), reactionT:rand(profile.reactionTime*0.75,profile.reactionTime*1.25),
        aimDir:vec(0,0,-1),
        accuracy:profile.accuracy,
        aggression:profile.aggression,
        coordination:profile.coordination,
        soundAwareness:profile.soundAwareness,
        utilityBaitChance:profile.utilityBaitChance,
        peekDiscipline:profile.peekDiscipline,
        // AI state machine
        aiState:'freeze',      // freeze|route|peek|engage|retreat|search|hold|support|plant|defuse
        prevAiState:'freeze',
        stateT:0,              // time in current state
        target:null as any,    // current enemy
        lastSeenPos:null as THREE.Vector3|null,
        lastSeenT:0,           // how long ago we saw enemy
        route:[] as THREE.Vector3[],
        routeIndex:0,
        anchor:pos.clone(),
        holdYaw:Math.PI,
        hasBomb:false,
        plantT:0,
        defuseT:0,
        strafeSeed:Math.random()*Math.PI*2,
        peekSide:Math.random()<0.5?1:-1,
        retreatPos:null as THREE.Vector3|null,
        coverPos:null as THREE.Vector3|null,
        teamCallouts:[] as string[],  // for coordination
        rushDelay:rand(0,1.8),        // stagger T rushes
        shotCount:0,                  // shots fired (for burst discipline)
        burstRest:0,                  // rest timer between bursts
        damagedT:999,
        heardSoundPos:null as THREE.Vector3|null,
        heardSoundAge:999,
        enemyMemory:undefined,
        danger:0,
        lastDecision:'hold-crossfire',
        supportTarget:null as THREE.Vector3|null,
        angleMemory:[] as number[],   // angles this bot is watching
        navPath:[] as THREE.Vector3[],
        navIndex:0,
        navGoal:null as THREE.Vector3|null,
        navRepathAt:0,
        navStuckT:0,
        navLastPos:pos.clone(),
        aimState: createAimState(),
        combatSnapshot: createCombatSnapshot('patrolling'),
        navState: createBotNavState(pos),
        spine: (model as any).spine || null,
      };
    }

    function clearBots(){
      while(bots.length){
        const b=bots.pop();
        scene.remove(b.obj);
        disposeObject3DResourcesWithOptions(b.obj, { disposeTextureMaps: false });
      }
    }
    function clearDroppedWeapons(){
      while(droppedWeapons.length){
        const w = droppedWeapons.pop();
        if (w) {
          scene.remove(w.group);
          disposeObject3DResourcesWithOptions(w.group, { disposeTextureMaps: false });
        }
      }
    }

    function spawnDroppedBomb(pos:THREE.Vector3, baseY=0){
      if(droppedBombMesh){
        scene.remove(droppedBombMesh);
        disposeObject3DResources(droppedBombMesh);
      }
      droppedBombMesh=new THREE.Group();
      const body=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.18,0.3),new THREE.MeshStandardMaterial({color:0x2b2f35,metalness:0.28,roughness:0.56}));
      const led=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.03,0.12),new THREE.MeshStandardMaterial({color:0x990000,emissive:new THREE.Color(0xff4d4d),emissiveIntensity:0.8}));
      led.position.set(0.1,0.06,0); droppedBombMesh.add(body,led);
      droppedBombMesh.position.copy(pos); droppedBombMesh.position.y=baseY + 0.14;
      shadowify(droppedBombMesh); scene.add(droppedBombMesh);
    }

    function clearBombWorld(){
      if(state.bomb?.mesh){
        scene.remove(state.bomb.mesh);
        disposeObject3DResources(state.bomb.mesh);
      }
      state.bomb=null;
      if(droppedBombMesh){
        scene.remove(droppedBombMesh);
        disposeObject3DResources(droppedBombMesh);
        droppedBombMesh=null;
      }
      droppedBomb=null;
    }

    // ─── ROUND ROUTES ───────────────────────────────────────────────────────────
    const routesA = [
      [vec(-26,4.65,-36),vec(-34,4.65,-30),vec(-40,4.65,-22),vec(-36,4.65,-14),vec(-30,4.65,-10)],
      [vec(-22,4.65,-34),vec(-18,4.65,-26),vec(-20,4.65,-18),vec(-24,4.65,-12),vec(-30,4.65,-10)],
      [vec(-16,4.65,-34),vec(-6,4.65,-24),vec(-4,4.65,-12),vec(-14,4.65,-10),vec(-30,4.65,-10)],
      [vec(-12,4.65,-34),vec(2,4.65,-28),vec(14,4.65,-24),vec(6,4.65,-14),vec(-10,4.65,-10),vec(-30,4.65,-10)],
      [vec(-10,4.65,-36),vec(10,4.65,-30),vec(22,4.65,-22),vec(6,4.65,-8),vec(-18,4.65,-10)],
    ];
    const routesB = [
      [vec(-24,4.65,-36),vec(-16,4.65,-26),vec(-2,4.65,-22),vec(14,4.65,-22),vec(30,4.65,-18)],
      [vec(-18,4.65,-34),vec(-6,4.65,-28),vec(8,4.65,-26),vec(22,4.65,-22),vec(30,4.65,-18)],
      [vec(-10,4.65,-34),vec(8,4.65,-34),vec(22,4.65,-30),vec(34,4.65,-24),vec(30,4.65,-18)],
      [vec(-28,4.65,-34),vec(-34,4.65,-24),vec(-24,4.65,-14),vec(-6,4.65,-12),vec(14,4.65,-14),vec(30,4.65,-18)],
      [vec(-14,4.65,-36),vec(0,4.65,-20),vec(18,4.65,-12),vec(30,4.65,-18)],
    ];

    const ctAnchorsA = [
      {pos:vec(-26,4.65,-8), yaw:Math.PI*0.77},
      {pos:vec(4,4.65,-6),   yaw:Math.PI*0.94},
      {pos:vec(28,4.65,-18), yaw:Math.PI*1.08},
      {pos:vec(18,4.65,14),  yaw:Math.PI*1.18},
    ];
    const ctAnchorsB = [
      {pos:vec(-28,4.65,-10),yaw:Math.PI*0.82},
      {pos:vec(8,4.65,-10),  yaw:Math.PI},
      {pos:vec(30,4.65,-16), yaw:Math.PI*1.05},
      {pos:vec(24,4.65,10),  yaw:Math.PI*1.16},
    ];

    function configureBots(){
      if (bots.length > 0) return; 

      let neededCT = 5;
      let neededT = 5;
      
      if (isMultiplayerRef.current) {
        if (!isHostRef.current) return; 
        const roomState = roomManager.getState();
        const teamSize = roomState.settings.teamSize || 5;
        const humanCT = roomState.players.filter(p => p.team === 'CT').length;
        const humanT = roomState.players.filter(p => p.team === 'T').length;
        neededCT = Math.max(0, teamSize - humanCT);
        neededT = Math.max(0, teamSize - humanT);
      } else {
        const team = playerTeamRef.current || 'CT';
        neededCT = team === 'CT' ? 4 : 5;
        neededT = team === 'T' ? 4 : 5;
      }

      console.log(`[MATCH] Spawning ${neededCT} CT and ${neededT} T bots. (Local Team: ${playerTeamRef.current})`);

      const ctSpawns = [vec(16,4.65,30),vec(20.5,4.65,28),vec(24,4.65,30),vec(28,4.65,28),vec(14,4.65,30)];
      const tSpawnsA = [vec(-35.3,4.65,-34.6),vec(-24,4.65,-30),vec(-16.5,4.65,-34),vec(-11.7,4.65,-31),vec(-12,4.65,-34)];
      const tSpawnsB = [vec(-28,4.65,-30),vec(-16.5,4.65,-36),vec(-14,4.65,-34),vec(-8,4.65,-30),vec(-22,4.65,-30)];
      const tSpawns = state.attackSite==='A'?tSpawnsA:tSpawnsB;
      const tRoles=['LEAD_L','SUPPORT_L','MID','SUPPORT_R','LEAD_R'];
      const ctRoles=['A_ANCHOR','MID','B_ANCHOR','FLOAT','ROTATE'];
      
      for(let i=0; i<neededCT; i++) {
        bots.push(makeBot('CT', ctSpawns[i] || ctSpawns[0], `CT-Bot${i+1}`, ctRoles[i] || 'FLOAT'));
      }
      for(let i=0; i<neededT; i++) {
        bots.push(makeBot('T', tSpawns[i] || tSpawns[0], `T-Bot${i+1}`, tRoles[i] || 'SUPPORT'));
      }

      const ts=bots.filter(b=>b.team==='T');
      if (player.team === 'T' && !isMultiplayerRef.current) {
        const carrier = Math.floor(Math.random() * (ts.length + 1));
        if (carrier === ts.length) player.hasBomb = true;
        else if (ts[carrier]) ts[carrier].hasBomb = true;
      } else if (ts.length > 0) {
        pick(ts.slice(0,3)).hasBomb=true;
      }
      
      const routes=state.attackSite==='A'?routesA:routesB;
      const ctAnchors=state.attackSite==='A'?ctAnchorsA:ctAnchorsB;
      ts.forEach((bot,i)=>{
        bot.route=(routes[i]||routes[2]).map((p:THREE.Vector3)=>p.clone());
        bot.routeIndex=0;
        bot.anchor=(state.attackSite==='A'?A_SITE:B_SITE).clone();
        bot.rushDelay=rand(0,2.2);
      });
      const cts=bots.filter(b=>b.team==='CT');
      cts.forEach((bot,i)=>{
        const anchor=ctAnchors[i]||ctAnchors[0];
        bot.anchor.copy(anchor.pos); bot.holdYaw=anchor.yaw;
      });
    }

    function botLoadout2(bot:any){ return botLoadout(bot.team); }

    function plantBomb(pos:THREE.Vector3,by:any){
      state.phase='planted';
      const mesh=new THREE.Group();
      const body=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.2,0.32),new THREE.MeshStandardMaterial({color:0x2b2f35,metalness:0.3,roughness:0.54}));
      const led=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.035,0.14),new THREE.MeshStandardMaterial({color:0x990000,emissive:new THREE.Color(0xff4d4d),emissiveIntensity:0.9}));
      const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.22,8),new THREE.MeshStandardMaterial({color:0x888888,metalness:0.7}));
      ant.position.set(-0.12,0.14,0); led.position.set(0.1,0.06,0);
      mesh.add(body,led,ant);
      const baseY = (by.team === 'T' && by.name === playerNameRef.current) ? pos.y - EYE : pos.y;
      mesh.position.copy(pos);mesh.position.y=baseY + 0.14;shadowify(mesh);scene.add(mesh);
      state.bomb={pos:mesh.position.clone(),timer:40,mesh};
      dom.bombIcon.style.display='block';dom.bombIcon.classList.add('armed');
      by.hasBomb=false;droppedBomb=null;
      if(droppedBombMesh){
        scene.remove(droppedBombMesh);
        disposeObject3DResources(droppedBombMesh);
        droppedBombMesh=null;
      }
      emitSoundEvent(by.team === 'CT' || by.team === 'T' ? by.team : 'neutral', mesh.position, 'objective', 1.25);
      playBombPlant();
    }

    // ─── COMBAT HELPERS ─────────────────────────────────────────────────────────
    const hitmarkT: Record<string,any> = {};
    function showHitmark(headshot = false){
      dom.hitmark.style.opacity='1';
      dom.hitmark.style.transform='translate(-50%,-50%) scale(' + (headshot ? '1.4' : '1.1') + ')';
      clearScheduledTimeout(hitmarkT.hm);
      hitmarkT.hm=scheduleTimeout(()=>{
        dom.hitmark.style.opacity='0';
        dom.hitmark.style.transform='translate(-50%,-50%) scale(1)';
      }, 140);
      dom.crosshair.classList.add('game-crosshair-hit');
      clearScheduledTimeout(hitmarkT.cx);
      hitmarkT.cx=scheduleTimeout(()=>dom.crosshair.classList.remove('game-crosshair-hit'), 95);
      if (headshot) {
        audioSystem.playHeadshotDink();
      }
    }

    function showDamage(){
      dom.damage.style.boxShadow='inset 0 0 160px rgba(239,68,68,.75)';
      clearScheduledTimeout(hitmarkT.dmg);
      hitmarkT.dmg=scheduleTimeout(()=>dom.damage.style.boxShadow='inset 0 0 120px rgba(255,0,0,0)', 350);
    }

    function triggerKillstreakBanner(text: string, sub: string) {
      if (!dom.killstreak || !dom.killstreakText || !dom.killstreakSub) return;
      dom.killstreakText.textContent = text;
      dom.killstreakSub.textContent = sub;
      dom.killstreak.classList.add('show');
      clearScheduledTimeout(hitmarkT.ks);
      hitmarkT.ks = scheduleTimeout(() => {
        dom.killstreak.classList.remove('show');
      }, 2400);
    }

    function showMvpCard(winnerTeam: string, name: string, reason: string) {
      if (!dom.mvpCard || !dom.mvpName || !dom.mvpReason) return;
      dom.mvpName.textContent = name;
      dom.mvpReason.textContent = reason;
      dom.mvpCard.classList.add('show');
      clearScheduledTimeout(hitmarkT.mvp);
      hitmarkT.mvp = scheduleTimeout(() => {
        dom.mvpCard.classList.remove('show');
      }, 4200);
    }

    function muzzleFlash(){
      dom.flash.style.opacity='0.14';clearScheduledTimeout(hitmarkT.fl);hitmarkT.fl=scheduleTimeout(()=>dom.flash.style.opacity='0',45);
      if(activeViewMuzzle){ const l=new THREE.PointLight(0xffd7a4,2.5,6.0,2);l.position.copy(activeViewMuzzle.position);viewModel.add(l);scheduleTimeout(()=>viewModel.remove(l),38); }
    }

    function spawnMuzzleFlashLight(position: THREE.Vector3, direction: THREE.Vector3) {
      const flashPos = position.clone().addScaledVector(direction, 0.45);
      const light = new THREE.PointLight(0xffaa44, 4.8, 8.5);
      light.position.copy(flashPos);
      scene.add(light);
      scheduleTimeout(() => {
        scene.remove(light);
        light.dispose();
      }, 35);
    }

    function spawnTracer(a:THREE.Vector3,b:THREE.Vector3,color=0xfff0a0){
      const geo=new THREE.BufferGeometry().setFromPoints([a,b]);
      let mat = tracerPlayerMat;
      if (color === 0xffe8aa) mat = tracerPlayerScopedMat;
      else if (color === 0xffd59c) mat = tracerTMat;
      else if (color === 0x9ad7ff) mat = tracerCTMat;
      const line=new THREE.Line(geo,mat); scene.add(line);
      scheduleTimeout(()=>{
        scene.remove(line);
        geo.dispose();
      },75);
    }

    function spawnImpact(pt:THREE.Vector3,c=0x27211c){
      const mat = (c === 0x33271d) ? impactMatBot : impactMatDefault;
      const m=new THREE.Mesh(impactGeo,mat);
      m.position.copy(pt);scene.add(m);
      
      // Spark burst VFX
      const sparksGroup = new THREE.Group();
      sparksGroup.position.copy(pt);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
      for (let i = 0; i < 5; i++) {
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), sparkMat);
        spark.position.set(rand(-0.05, 0.05), rand(-0.05, 0.05), rand(-0.05, 0.05));
        sparksGroup.add(spark);
      }
      scene.add(sparksGroup);

      scheduleTimeout(()=>{
        scene.remove(m);
        scene.remove(sparksGroup);
        disposeObject3DResources(sparksGroup);
      },3000);
    }

    function spawnBlood(pt:THREE.Vector3){
      const g=new THREE.Group();
      for(let i=0;i<10;i++){
        const p=new THREE.Mesh(bloodGeo,bloodMat);
        p.scale.setScalar(0.038 + Math.random() * 0.035);
        p.position.set(rand(-0.15,0.15),rand(-0.08,0.15),rand(-0.15,0.15));
        g.add(p);
      }
      g.position.copy(pt);scene.add(g);
      scheduleTimeout(()=>{
        scene.remove(g);
        disposeObject3DResources(g);
      },650);
    }
    function getCameraDir(){ const v=new THREE.Vector3(0,0,-1);v.applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ'));return v; }

    function weaponDamage(w:any,part:string,dist:number,scoped:boolean){
      let dmg=w.dmg*(part==='head'?w.headMul:1);
      dmg*=1-clamp(dist/w.range,0,1.25)*0.12;
      if(w.scoped&&!scoped)dmg*=0.92;
      return Math.max(1,dmg);
    }
    function applyArmor(target:any,dmg:number,w:any,part:string){
      const armored=target.armor>0&&(part!=='head'||target.helmet);
      if(!armored)return dmg;
      const pen=clamp(w.armorPen??0.7,0.4,1);
      const absorbed=dmg*(1-pen)*(part==='head'?0.7:0.9);
      target.armor=Math.max(0,target.armor-absorbed*1.1);
      return Math.max(1,dmg-absorbed*0.55);
    }

    function shootRay(origin:THREE.Vector3,dir:THREE.Vector3,range:number,shooter:any){
      raycaster.set(origin,dir);raycaster.far=range;
      let best:any=null;
      const shooterTeam = shooter === 'player' ? player.team : shooter.team;
      
      // Check hits on bots using AABB hitboxes
      for(const bot of bots){
        if(!bot.alive||bot===shooter||bot.team===shooterTeam)continue;
        const hitPart = findHitPart(origin, dir, bot.obj.position);
        if (hitPart) {
          const hitPoint = origin.clone().addScaledVector(dir, hitPart.distance);
          const hit = { dist: hitPart.distance, bot, part: hitPart.part, point: hitPoint };
          if (!best || hit.dist < best.dist) best = hit;
        }
      }
      
      // Check hits on local player
      if(shooter!=='player'&&player.alive&&shooter.team!==player.team){
        const feetY = player.pos.y - (player.height || (player.crouch ? CROUCH_HEIGHT : PLAYER_HEIGHT));
        const playerBase = new THREE.Vector3(player.pos.x, feetY, player.pos.z);
        const hitPart = findHitPart(origin, dir, playerBase);
        if (hitPart) {
          const hitPoint = origin.clone().addScaledVector(dir, hitPart.distance);
          if (!best || hitPart.distance < best.dist) {
            best = { dist: hitPart.distance, isPlayer: true, part: hitPart.part, point: hitPoint };
          }
        }
      }
      
      // Check hits on remote players
      for(const [id, remote] of remotePlayers.entries()) {
         if (remote.hp <= 0 || remote.team === shooterTeam) continue;
         const hitPart = findHitPart(origin, dir, remote.obj.position);
         if (hitPart) {
           const hitPoint = origin.clone().addScaledVector(dir, hitPart.distance);
           const hit = { dist: hitPart.distance, remoteId: id, remote, part: hitPart.part, point: hitPoint };
           if (!best || hit.dist < best.dist) best = hit;
         }
      }

      const bvhHit = mapBVH.raycast(origin, dir);
      if (bvhHit) {
        if (!best || bvhHit.dist < best.dist) {
          best = { dist: bvhHit.dist, isWall: true, point: bvhHit.point };
        }
      }
      return best;
    }

    function addKillfeed(killer:any,victim:any,weapon:string, headshot = false){
      const e=document.createElement('div');e.className='game-kf';
      const killerName = document.createElement('span');
      killerName.className = 'game-kf-a';
      killerName.style.color = killer.team==='CT'?'#87b9ff':'#f0a366';
      killerName.textContent = killer.name || 'YOU';
      const weaponName = document.createElement('span');
      weaponName.className = 'game-kf-b';
      weaponName.textContent = `[${weapon}]`;
      const hsSpan = document.createElement('span');
      if (headshot) {
        hsSpan.className = 'game-kf-hs';
        hsSpan.textContent = ' 🎯';
      }
      const victimName = document.createElement('span');
      victimName.className = 'game-kf-a';
      victimName.style.color = victim.team==='CT'?'#87b9ff':'#f0a366';
      victimName.textContent = victim.name || 'YOU';
      e.append(killerName, weaponName, hsSpan, victimName);
      dom.killfeed.appendChild(e);scheduleTimeout(()=>e.remove(),5000);
    }

    function applyDamageToBot(bot:any,dmg:number,remainingArmor:number,w:any,killer:any,part:string,hitPoint:THREE.Vector3){
      if(!bot.alive)return;
      const isHeadshot = part === 'head';
      bot.hp = Math.max(0, bot.hp - dmg);
      bot.armor = remainingArmor;
      bot.damagedT=0;
      if(bot.hp<=0){
        bot.alive=false;bot.obj.visible=false;
        bot.deaths++;
        if(killer==='player') {
          player.kills++;
          player.roundKills++;
          if (isHeadshot) player.roundHeadshots++;

          // Kill chime & streak announcers
          audioSystem.playKillChime(player.roundKills);
          let bannerText = '';
          const subText = `ELIMINATED ${bot.name}`;
          if (player.roundKills === 2) { bannerText = '★ DOUBLE KILL ★'; audioSystem.playAnnouncerVoice('doubleKill'); }
          else if (player.roundKills === 3) { bannerText = '🔥 TRIPLE KILL 🔥'; audioSystem.playAnnouncerVoice('tripleKill'); }
          else if (player.roundKills === 4) { bannerText = '⚡ QUAD KILL ⚡'; audioSystem.playAnnouncerVoice('quadKill'); }
          else if (player.roundKills >= 5) { bannerText = '👑 ACE - 5K RAMPAGE! 👑'; audioSystem.playAnnouncerVoice('ace'); }
          else if (isHeadshot) { bannerText = '🎯 HEADSHOT!'; audioSystem.playAnnouncerVoice('headshot'); }

          if (bannerText) triggerKillstreakBanner(bannerText, subText);
        }
        else if(killer?.kills !== undefined) killer.kills++;
        if(bot.hasBomb){const p=bot.obj.position.clone();const bY=bot.obj.position.y;droppedBomb={pos:p,baseY:bY};spawnDroppedBomb(p,bY);}
        if(bot.weapon!=='knife') createDroppedWeapon(bot.weapon,bot.obj.position.clone(),bot.ammoMag,0, bot.obj.position.y);
        spawnBlood(hitPoint);
        addKillfeed({name:killer==='player'?'YOU':killer.name,team:killer==='player'?player.team:killer.team},bot,w.name, isHeadshot);
        if(killer==='player')player.money=Math.min(16000,player.money+(w.reward||300));
        // Alert teammates with trade-frag priority
        const radius = 28;
        const killerPos = killer === 'player' ? player.pos.clone() : (killer?.obj?.position.clone() ?? bot.obj.position.clone());
        bots.filter(b => b.alive && b.team === bot.team && b.obj.position.distanceTo(bot.obj.position) < radius).forEach(b => {
          b.lastSeenPos = killerPos.clone();
          b.lastSeenT = 0;
          b.tradeFragTarget = killerPos.clone();
          if (b.combatSnapshot) b.combatSnapshot.state = 'engaging';
          b.stateT = 0;
        });
        checkRoundEnd();
      }
      updateHUD();
    }

    function damagePlayerWithDetails(dmg:number,remainingArmor:number,byBot:any,w:any,part:string){
      if(!player.alive)return;
      player.hp = Math.max(0, player.hp - dmg);
      player.armor = remainingArmor;
      player.inspecting = false; player.inspectT = 0; // Cancel weapon inspect on hit
      showDamage();
      if (player.hp > 0 && player.hp < 30) {
        audioSystem.playLowHpHeartbeat();
      }
      if(player.hp<=0){
        player.alive=false;player.hp=0;player.scoped=false;document.exitPointerLock();
        player.deaths++;
        if(player.hasBomb){player.hasBomb=false;const p=player.pos.clone();const bY=player.pos.y-EYE;droppedBomb={pos:p,baseY:bY};spawnDroppedBomb(p,bY);}
        if(byBot?.kills !== undefined) byBot.kills++;
        if(byBot?.obj){
          const killerPos = byBot.obj.position.clone();
          bots.filter(b => b.alive && b.team === player.team).forEach(teammate => {
            if (teammate.obj.position.distanceTo(player.pos) < 28) {
              teammate.lastSeenPos = killerPos.clone();
              teammate.lastSeenT = 0;
              teammate.tradeFragTarget = killerPos.clone();
              if (teammate.combatSnapshot) teammate.combatSnapshot.state = 'engaging';
            }
          });
        }
        addKillfeed({name:byBot.name,team:byBot.team},{name:'YOU',team:player.team},w.name, part==='head');
        checkRoundEnd();
      }
      updateHUD();
    }

    function checkRoundEnd(){
      if(state.phase!=='live'&&state.phase!=='planted')return;
      const ctA=(player.alive&&player.team==='CT'?1:0)+bots.filter(b=>b.alive&&b.team==='CT').length;
      const tA=(player.alive&&player.team==='T'?1:0)+bots.filter(b=>b.alive&&b.team==='T').length;
      if(state.phase==='planted'){
        if(ctA===0)return endRound('T','Bomb planted · CTs eliminated');
        if(tA===0&&!state.bomb)return endRound('CT','Terrorists eliminated');
      } else {
        if(tA===0)return endRound('CT','Terrorists eliminated');
        if(ctA===0)return endRound('T','CTs eliminated');
      }
    }

    function reload(){
      const w=activeWeapon();if(w.type!=='gun'||player.reloading)return;
      const a=ammoFor(player.weapon);if(a.reserve<=0||a.mag>=a.magSize)return;
      player.reloading=true;player.reloadT=w.reload;player.reloadWeapon=player.weapon;player.scoped=false;
    }
    function finishReload(){
      if(!player.reloadWeapon)return;
      const a=ammoFor(player.reloadWeapon);const n=a.magSize-a.mag;const g=Math.min(n,a.reserve);
      a.mag+=g;a.reserve-=g;player.reloading=false;player.reloadWeapon=null;
    }

    // ─── PLAYER INPUT ───────────────────────────────────────────────────────────
    const keys:Record<string,boolean>={};
    let mouseLocked=false,mouseDown=false,mousePressed=false,interactPressed=false;
    const onKD=(e:KeyboardEvent)=>{
      keys[e.code]=true;
      if(e.code==='Tab'){e.preventDefault();state.scoreboardOpen=true;updateHUD();return;}
      if(e.repeat)return;
      unlockAudio();
      if(e.code==='KeyB'&&state.phase==='freeze'&&player.alive)setBuyOpen(!state.buyOpen);
      if(state.buyOpen){
        const n = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : 0;
        const item = n > 0 ? BUY_ITEMS()[n - 1] : null;
        if(item){e.preventDefault();buyItem(item);return;}
        if(e.code==='Escape'){setBuyOpen(false);return;}
      }
      if(e.code==='Digit1'){ player.inspecting=false; player.inspectT=0; equipSlot('primary'); }
      if(e.code==='Digit2'){ player.inspecting=false; player.inspectT=0; equipSlot('sidearm'); }
      if(e.code==='Digit3'){ player.inspecting=false; player.inspectT=0; equipSlot('knife'); }
      if(e.code==='KeyR'){ player.inspecting=false; player.inspectT=0; reload(); }
      if(e.code==='KeyG'){ player.inspecting=false; player.inspectT=0; dropCurrentWeapon(); }
      if(e.code==='KeyF'&&player.alive&&!player.scoped&&!player.reloading){
        player.inspecting = true;
        player.inspectT = 0;
        audioSystem.playInspectSound();
      }
      if(e.code==='KeyE')interactPressed=true;
      // Spectator: cycle through alive teammates when dead
      if(!player.alive&&state.started){
        if(e.code==='Mouse0'||e.code==='ArrowRight'||e.code==='Space'){state.specIdx++;state.specIdx=Math.max(0,state.specIdx);}
        if(e.code==='ArrowLeft'){state.specIdx=Math.max(0,state.specIdx-1);}
      }
    };
    const onKU=(e:KeyboardEvent)=>{ keys[e.code]=false;if(e.code==='Tab'){e.preventDefault();state.scoreboardOpen=false;updateHUD();} };
    const onMD=(e:MouseEvent)=>{ unlockAudio(); if(e.button===0){mouseDown=true;mousePressed=true;} };
    const onMU=(e:MouseEvent)=>{ if(e.button===0){mouseDown=false;mousePressed=false;player.recoilIdx=Math.max(0,player.recoilIdx-1);} };
    const onPD=(e:PointerEvent)=>{ unlockAudio(); if(e.button===2){e.preventDefault();const w=activeWeapon();if(w.scoped){player.scoped=!player.scoped;playScopeToggle(player.scoped);}} };
    const onCM=(e:MouseEvent)=>{ if(e.target===renderer.domElement)e.preventDefault(); };
    const onMM=(e:MouseEvent)=>{
      if(!mouseLocked)return;
      const s=0.0022;
      player.yaw-=e.movementX*s;
      player.pitch-=e.movementY*s;
      player.pitch=clamp(player.pitch,-Math.PI/2+0.01,Math.PI/2-0.01);
      mouseVelX += e.movementX;
      mouseVelY += e.movementY;
    };
    const onPLC=()=>{ mouseLocked=document.pointerLockElement===renderer.domElement; };
    addEventListener('keydown',onKD);addEventListener('keyup',onKU);
    addEventListener('mousedown',onMD);addEventListener('mouseup',onMU);
    addEventListener('pointerdown',onPD);addEventListener('contextmenu',onCM);
    addEventListener('mousemove',onMM);document.addEventListener('pointerlockchange',onPLC);

    function requestAimLock(){
      try{
        const req = renderer.domElement.requestPointerLock();
        if(req && typeof (req as Promise<void>).catch === 'function') void (req as Promise<void>).catch(()=>{});
      } catch {}
    }

    function enterMatch(){
      unlockAudio();
      dom.hud.style.display='block';
      player.team=playerTeamRef.current;
      if(dom.playerTag){dom.playerTag.textContent=`${playerNameRef.current} · ${player.team}`;}
      
      // Ensure local hands match the selected team
      syncViewModel(player.weapon, player.team);
      
      state.started=true;state.matchOver=false;
      requestAimLock();
      console.log(`Entering match as ${player.team}...`);
      startRound();
    }
    enterMatchRef.current=enterMatch;
    const onCanvasClick = () => { if(state.started&&player.alive&&!state.buyOpen&&!mouseLocked) requestAimLock(); };
    renderer.domElement.addEventListener('click', onCanvasClick);

    // ─── PLAYER PHYSICS ──────────────────────────────────────────────────────────
    function moveWithCollision(pos:THREE.Vector3,vel:THREE.Vector3,dt:number,r:number,eyeH:number){
      const try1=(ax:'x'|'y'|'z')=>{
        const n=pos.clone();n[ax]+=vel[ax]*dt;
        const mn=vec(n.x-r,n.y-eyeH,n.z-r),mx=vec(n.x+r,n.y+0.1,n.z+r);
        for(const c of colliders){ if(mn.x<c.max.x&&mx.x>c.min.x&&mn.y<c.max.y&&mx.y>c.min.y&&mn.z<c.max.z&&mx.z>c.min.z){
          if(ax==='y'){
            if(vel.y<0){pos.y=c.max.y+eyeH;vel.y=0;return true;}
            else if(vel.y>0){pos.y=c.min.y-0.1;vel.y=0;return false;}
          }
          vel[ax]=0;return true;
        } }
        pos[ax]=n[ax];
        return false;
      };
      try1('x');try1('z');const hit=try1('y');
      // Enforce map boundaries clamping to [-60.0, 60.0]
      if (pos.x < -60.0) { pos.x = -60.0; vel.x = 0; }
      else if (pos.x > 60.0) { pos.x = 60.0; vel.x = 0; }
      if (pos.z < -60.0) { pos.z = -60.0; vel.z = 0; }
      else if (pos.z > 60.0) { pos.z = 60.0; vel.z = 0; }
      if(pos.y<CT_SPAWN_POS.y+eyeH){pos.y=CT_SPAWN_POS.y+eyeH;vel.y=0;return true;}
      return hit;
    }

    function applyGroundFriction(dt:number, friction:number){
      const next = applyGroundFrictionToVelocity({ x: player.vel.x, z: player.vel.z }, dt, friction);
      player.vel.x = next.x;
      player.vel.z = next.z;
    }

    function acceleratePlayer(wish:THREE.Vector3,wishSpeed:number,accel:number,dt:number){
      const current=player.vel.dot(wish);
      const add=wishSpeed-current;
      if(add<=0)return;
      player.vel.addScaledVector(wish,Math.min(add,accel*wishSpeed*dt));
    }

    function capHorizontalSpeed(maxSpeed:number){
      const speed=hspd(player.vel);
      if(speed<=maxSpeed)return;
      const scale=maxSpeed/speed;
      player.vel.x*=scale;player.vel.z*=scale;
    }

    function counterStrafe(fwd:THREE.Vector3,rgt:THREE.Vector3){
      const next = applyCounterStrafeToVelocity(
        { x: player.vel.x, z: player.vel.z },
        { x: fwd.x, z: fwd.z },
        { x: rgt.x, z: rgt.z },
        {
          forward: !!keys.KeyW,
          backward: !!keys.KeyS,
          left: !!keys.KeyA,
          right: !!keys.KeyD,
        },
      );
      player.vel.x = next.x;
      player.vel.z = next.z;
    }

    function playerShoot(){
      const w=activeWeapon();if(w.type==='melee')return false;
      if(player.shootCD>0||player.reloading)return false;
      const a=ammoFor(player.weapon);if(a.mag<=0){reload();return false;}
      a.mag--;player.shootCD=w.cd;
      player.pitch-=computePitchKick(w, player.recoilIdx);
      player.pitch=clamp(player.pitch,-Math.PI/2+0.01,Math.PI/2-0.01);
      player.recoilIdx=advanceRecoilIndex(w, player.recoilIdx);
      player.cameraPunch = CAMERA_PUNCH_PITCH;
      
      const spd=hspd(player.vel),mr=clamp(spd/(w.moveSpeed||5),0,1.4);
      const spread=computePlayerSpread(w, {
        horizontalSpeedRatio: mr,
        recoilIndex: player.recoilIdx,
        onGround: player.onGround,
        crouched: player.crouch,
        scoped: player.scoped,
        timeSinceStationary: player.timeSinceStationary,
        timeSinceJump: player.timeSinceJump,
        speed: spd,
        maxSpeed: w.moveSpeed || 5.2,
      });
      const dir=getCameraDir();
      dir.x+=(Math.random()-.5)*spread;dir.y+=(Math.random()-.5)*spread;dir.z+=(Math.random()-.5)*spread;dir.normalize();
      muzzleFlash();playGunshot(player.weapon);
      emitSoundEvent(player.team, camera.position, 'gunshot', w.scoped ? 1.15 : 1);
      spawnMuzzleFlashLight(camera.position, dir);
      
      const hit=shootRay(camera.position,dir,w.range,'player');
      if(hit){
        spawnTracer(camera.position,hit.point,w.scoped?0xffe8aa:0xfff0a0);
        if(hit.bot){
          const dmgRes = computeDamage({
            baseDamage: w.scoped && !player.scoped ? w.dmg * 0.92 : w.dmg,
            bodyPart: hit.part as BodyPart,
            armorPenetration: w.armorPen ?? 0.7,
            targetArmor: hit.bot.armor,
            targetHasHelmet: hit.bot.helmet,
            distance: hit.dist,
            maxRange: w.range,
          });
          applyDamageToBot(hit.bot, dmgRes.damage, dmgRes.remainingArmor, w, 'player', hit.part, hit.point);
          showHitmark(dmgRes.isHeadshot);
          playHitSound(dmgRes.isHeadshot);
        }
        else if(hit.remoteId) {
          const dmgRes = computeDamage({
            baseDamage: w.scoped && !player.scoped ? w.dmg * 0.92 : w.dmg,
            bodyPart: hit.part as BodyPart,
            armorPenetration: w.armorPen ?? 0.7,
            targetArmor: hit.remote.armor || 0,
            targetHasHelmet: hit.remote.helmet || false,
            distance: hit.dist,
            maxRange: w.range,
          });
          showHitmark(dmgRes.isHeadshot); playHitSound(dmgRes.isHeadshot); spawnBlood(hit.point);
          roomManager.sendUpdate({
            type: 'DAMAGE',
            targetId: hit.remoteId,
            damage: dmgRes.damage,
            killerId: roomManager.getMyId(),
            weapon: player.weapon,
            part: hit.part
          });
        }
        else if(hit.isWall)spawnImpact(hit.point);
      } else spawnTracer(camera.position,camera.position.clone().add(dir.multiplyScalar(w.range)));
      updateHUD();return true;
    }

    function updatePlayer(dt:number){
      // Spectator camera when dead
      if(!player.alive && state.started && !state.matchOver) {
        const friendlyBots = bots.filter(b => b.alive && b.team === player.team);
        if(friendlyBots.length > 0) {
          state.specIdx = state.specIdx % friendlyBots.length;
          const spec = friendlyBots[state.specIdx];
          state.specTarget = spec;
          syncViewModel(spec.weapon, spec.team as Team);
          const specEye = spec.obj.position.clone(); specEye.y += 1.55;
          camera.position.lerp(specEye, 0.08);
          const lookDir = spec.aimDir || new THREE.Vector3(0, 0, -1);
          const lookAt = specEye.clone().add(lookDir);
          camera.lookAt(lookAt);
          viewModel.visible = true;
        } else {
          state.specTarget = null;
          viewModel.visible = false;
        }
        return;
      }
      state.specTarget = null;
      syncViewModel(player.weapon, player.team);
      if(!state.started||state.matchOver||!player.alive)return;
      const w=activeWeapon();const ce=mouseLocked&&!state.buyOpen;
      player.crouch=!!keys.ControlLeft;player.walking=!!(keys.ShiftLeft||keys.ShiftRight);
      player.stepNoiseCd=Math.max(0,player.stepNoiseCd-dt);
      const sb=computeMovementSpeed(w.moveSpeed||5.2, {
        crouched: player.crouch,
        walking: player.walking,
        scoped: player.scoped,
      });
      const wish=new THREE.Vector3();
      const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
      const rgt=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
      if(ce){if(keys.KeyW)wish.add(fwd);if(keys.KeyS)wish.sub(fwd);if(keys.KeyD)wish.add(rgt);if(keys.KeyA)wish.sub(rgt);}
      const hasWish=wish.lengthSq()>0;
      if(hasWish)wish.normalize();
      if(ce&&keys.Space)player.jumpBuffer=0.105;
      else player.jumpBuffer=Math.max(0,player.jumpBuffer-dt);
      if(player.onGround){
        if(ce)counterStrafe(fwd,rgt);
        if(!(ce&&player.jumpBuffer>0))applyGroundFriction(dt,hasWish?5.6:8.4);
      }
      if(hasWish){
        acceleratePlayer(wish,player.onGround?sb:sb*0.92,player.onGround?15.2:3.15,dt);
        capHorizontalSpeed(player.onGround?sb:sb*1.16);
      } else if(!player.onGround) {
        player.vel.x*=Math.max(0,1-0.18*dt);player.vel.z*=Math.max(0,1-0.18*dt);
      }
      const spd=hspd(player.vel);
      if(player.onGround&&hasWish&&spd>1.25){
        playFootstep(clamp(spd/sb,0,1.3),player.walking||player.crouch);
        if(player.stepNoiseCd<=0){
          emitSoundEvent(player.team, player.pos, 'footstep', player.walking||player.crouch ? 0.45 : 0.72);
          player.stepNoiseCd=player.walking||player.crouch?0.48:0.34;
        }
      }
      if(ce&&player.onGround&&player.jumpBuffer>0){
        player.vel.y=6.85;player.onGround=false;player.jumpBuffer=0;player.scoped=false;
      }
      // First-shot accuracy tracking
      if (spd < 0.1) {
        player.timeSinceStationary = (player.timeSinceStationary || 0) + dt;
      } else {
        player.timeSinceStationary = 0;
      }
      if (player.onGround) {
        player.timeSinceJump = (player.timeSinceJump || 0) + dt;
      } else {
        player.timeSinceJump = 0;
      }

      player.vel.y-=22*dt;
      const wasG=player.onGround;
      const fallSpeed=Math.abs(player.vel.y);

      // Smooth crouch lerping
      const oldHeight = player.height !== undefined ? player.height : (player.crouch ? CROUCH_HEIGHT : PLAYER_HEIGHT);
      player.height = lerpCrouchHeight(oldHeight, player.crouch ? CROUCH_HEIGHT : PLAYER_HEIGHT, dt, 12);
      const dHeight = player.height - oldHeight;
      player.pos.y += dHeight;

      // Capsule movement physics
      const moveRes = moveWithCapsuleCollision(
        { x: player.pos.x, y: player.pos.y, z: player.pos.z },
        { x: player.vel.x, y: player.vel.y, z: player.vel.z },
        dt,
        { radius: 0.3, height: player.height },
        spatialGrid.getCollidersInRadius(player.pos.x, player.pos.z, 2.5)
      );

      player.pos.set(moveRes.position.x, moveRes.position.y, moveRes.position.z);
      player.vel.set(moveRes.velocity.x, moveRes.velocity.y, moveRes.velocity.z);
      player.onGround = moveRes.onGround;

      // Apply floor clamp
      if (player.pos.y < CT_SPAWN_POS.y + player.height) {
        player.pos.y = CT_SPAWN_POS.y + player.height;
        player.vel.y = 0;
        player.onGround = true;
      }

      if(!wasG&&player.onGround){player.landBob=1;playLandSound(clamp(fallSpeed/6.5,0.7,1.3));}
      player.landBob=Math.max(0,player.landBob-dt*5);

      // Visual camera punch decay
      player.cameraPunch = Math.max(0, (player.cameraPunch || 0) - dt * (1000 / CAMERA_PUNCH_RECOVERY_MS) * CAMERA_PUNCH_PITCH);

      camera.position.copy(player.pos);
      camera.rotation.set(player.pitch - (player.cameraPunch || 0), player.yaw, 0, 'YXZ');
      if(player.shootCD>0)player.shootCD-=dt;
      if(player.reloading){player.reloadT-=dt;if(player.reloadT<=0)finishReload();}
      player.shooting = mouseDown;
      if(ce){const wa=w.auto&&mouseDown;const ws=!w.auto&&mousePressed;if(wa||ws){const f=playerShoot();if(f&&!w.auto)mousePressed=false;}}
      if(!mouseDown)mousePressed=false;
      if(!mouseDown&&player.recoilIdx>0&&player.shootCD<=0)player.recoilIdx=recoverRecoilIndex(player.recoilIdx, dt);
      handleInteractions(dt,ce);interactPressed=false;
    }

    // ─── IMPROVED BOT AI ────────────────────────────────────────────────────────
    function losClear(from:THREE.Vector3,to:THREE.Vector3){
      return mapBVH.losClear(from, to);
    }

    function findEnemy(bot:any){
      const isT=bot.team==='T';
      const targets=[
        ...(isT?bots.filter(b=>b.alive&&b.team==='CT'):[bots.filter(b=>b.alive&&b.team==='T')].flat()),
        ...(player.alive&&player.team!==bot.team?[{isPlayer:true,pos:player.pos.clone(),obj:null}]:[] )
      ];
      let best:any=null,bd=999;
      for(const e of targets){
        const epos=(e as any).isPlayer?(e as any).pos:(e as any).obj.position;
        const myEye=bot.obj.position.clone();myEye.y+=1.45;
        const thEye=epos.clone();thEye.y+=1.45;
        if(!losClear(myEye,thEye))continue;
        const d=bot.obj.position.distanceTo(epos);
        if(d<bd){bd=d;best={ent:e,pos:epos.clone(),dist:d};}
      }
      if(best){
        bot.lastSeenPos=best.pos.clone();bot.lastSeenT=0;
        const calloutRadius = 14 + (bot.coordination ?? 0.5) * 16;
        bots.filter(b=>b.alive&&b.team===bot.team&&b!==bot&&b.obj.position.distanceTo(bot.obj.position)<calloutRadius).forEach(b=>{
          if(!b.lastSeenPos||b.lastSeenT>0.6){b.lastSeenPos=best.pos.clone();b.lastSeenT=Math.min(b.lastSeenT,0.35);}
        });
      }
      return best;
    }

    function blocksActor(c:{min:THREE.Vector3;max:THREE.Vector3}) {
      const h = c.max.y - c.min.y;
      return c.max.y > 0.35 && h > 0.35;
    }

    function blockedAt(x:number,z:number,r=0.42){
      const nearby = spatialGrid.getCollidersInRadius(x, z, r + 0.5);
      const mnX=x-r,mxX=x+r,mnZ=z-r,mxZ=z+r;
      for(let i=0; i<nearby.length; i++){
        const c = nearby[i];
        if(!blocksActor(c))continue;
        if(mnX<c.max.x&&mxX>c.min.x&&mnZ<c.max.z&&mxZ>c.min.z)return true;
      }
      return false;
    }

    function botCollides(pos:THREE.Vector3){
      return blockedAt(pos.x,pos.z,0.38);
    }

    function botMoveDirect(bot:any,target:THREE.Vector3,dt:number,speed=3.2){
      tempV1.copy(target).sub(bot.obj.position);tempV1.y=0;
      const d=tempV1.length();if(d<0.28)return true;
      tempV1.normalize().multiplyScalar(speed);
      const next=bot.obj.position.clone();
      const ox=next.x;next.x+=tempV1.x*dt;if(botCollides(next))next.x=ox;
      const oz=next.z;next.z+=tempV1.z*dt;if(botCollides(next))next.z=oz;
      if(next.x===ox&&next.z===oz){
        const side=vec(-tempV1.z,0,tempV1.x).normalize().multiplyScalar(speed*dt*0.62);
        next.x=bot.obj.position.x+side.x;next.z=bot.obj.position.z+side.z;
        if(botCollides(next)){next.x=bot.obj.position.x-side.x;next.z=bot.obj.position.z-side.z;}
        if(botCollides(next)){next.copy(bot.obj.position);}
      }
      next.x = Math.max(-60.0, Math.min(60.0, next.x));
      next.z = Math.max(-60.0, Math.min(60.0, next.z));
      bot.obj.position.copy(next);
      bot.obj.rotation.y=Math.atan2(target.x-bot.obj.position.x,target.z-bot.obj.position.z);
      return false;
    }

    const NAV_STEP = 1.8, NAV_MIN = -66, NAV_MAX = 66;
    const NAV_W = Math.floor((NAV_MAX - NAV_MIN) / NAV_STEP) + 1;
    const NAV_H = NAV_W;
    let navReady = false;
    const navWalkable = new Uint8Array(NAV_W * NAV_H);

    function navIdx(x:number,z:number){return z*NAV_W+x;}
    function navIn(x:number,z:number){return x>=0&&z>=0&&x<NAV_W&&z<NAV_H;}
    function worldToNav(v:THREE.Vector3){return {x:clamp(Math.round((v.x-NAV_MIN)/NAV_STEP),0,NAV_W-1),z:clamp(Math.round((v.z-NAV_MIN)/NAV_STEP),0,NAV_H-1)};}
    function navToWorld(x:number,z:number){return vec(NAV_MIN+x*NAV_STEP,0,NAV_MIN+z*NAV_STEP);}

    function ensureNavGrid(){
      if(navReady)return;
      for(let z=0;z<NAV_H;z++){
        for(let x=0;x<NAV_W;x++){
          const p=navToWorld(x,z);
          navWalkable[navIdx(x,z)] = blockedAt(p.x,p.z,0.48) ? 0 : 1;
        }
      }
      navReady=true;
    }

    function nearestWalkableCell(cell:{x:number;z:number}){
      ensureNavGrid();
      if(navIn(cell.x,cell.z)&&navWalkable[navIdx(cell.x,cell.z)])return cell;
      for(let r=1;r<14;r++){
        for(let dz=-r;dz<=r;dz++){
          for(let dx=-r;dx<=r;dx++){
            if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
            const x=cell.x+dx,z=cell.z+dz;
            if(navIn(x,z)&&navWalkable[navIdx(x,z)])return {x,z};
          }
        }
      }
      return cell;
    }

    function lineClear2D(a:THREE.Vector3,b:THREE.Vector3,r=0.42){
      const dx=b.x-a.x,dz=b.z-a.z;
      const dist=Math.hypot(dx,dz);
      const steps=Math.max(1,Math.ceil(dist/(NAV_STEP*0.45)));
      for(let i=1;i<=steps;i++){
        const t=i/steps;
        if(blockedAt(a.x+dx*t,a.z+dz*t,r))return false;
      }
      return true;
    }

    function smoothPath(points:THREE.Vector3[]){
      if(points.length<3)return points;
      const out=[points[0]];
      let anchor=0;
      while(anchor<points.length-1){
        let far=points.length-1;
        while(far>anchor+1&&!lineClear2D(points[anchor],points[far],0.44))far--;
        out.push(points[far]);
        anchor=far;
      }
      return out;
    }

    function buildNavPath(from:THREE.Vector3,to:THREE.Vector3){
      ensureNavGrid();
      const start=nearestWalkableCell(worldToNav(from));
      const goal=nearestWalkableCell(worldToNav(to));
      const sIdx=navIdx(start.x,start.z),gIdx=navIdx(goal.x,goal.z);
      if(sIdx===gIdx)return [from.clone(), navToWorld(goal.x,goal.z)];
      const total=NAV_W*NAV_H;
      const came=new Int32Array(total);came.fill(-1);
      const gScore=new Float32Array(total);gScore.fill(Infinity);
      const fScore=new Float32Array(total);fScore.fill(Infinity);
      const open:number[]=[sIdx];
      const openSet=new Uint8Array(total);openSet[sIdx]=1;
      gScore[sIdx]=0;
      fScore[sIdx]=Math.hypot(goal.x-start.x,goal.z-start.z);
      const dirs=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[-1,1,1.414],[1,-1,1.414],[-1,-1,1.414]];
      while(open.length){
        let bestI=0,best=open[0],bestF=fScore[best];
        for(let i=1;i<open.length;i++){const idx=open[i];if(fScore[idx]<bestF){bestF=fScore[idx];best=idx;bestI=i;}}
        open.splice(bestI,1);openSet[best]=0;
        if(best===gIdx){
          const cells:number[]=[];let cur=best;
          while(cur!==-1){cells.push(cur);cur=came[cur];}
          cells.reverse();
          const pts=cells.map(i=>navToWorld(i%NAV_W,Math.floor(i/NAV_W)));
          return smoothPath(pts);
        }
        const cx=best%NAV_W,cz=Math.floor(best/NAV_W);
        for(const [dx,dz,cost] of dirs){
          const nx=cx+dx,nz=cz+dz;
          if(!navIn(nx,nz))continue;
          const ni=navIdx(nx,nz);
          if(!navWalkable[ni])continue;
          if(dx&&dz&&(!navWalkable[navIdx(cx+dx,cz)]||!navWalkable[navIdx(cx,cz+dz)]))continue;
          const tentative=gScore[best]+cost;
          if(tentative>=gScore[ni])continue;
          came[ni]=best;gScore[ni]=tentative;fScore[ni]=tentative+Math.hypot(goal.x-nx,goal.z-nz);
          if(!openSet[ni]){open.push(ni);openSet[ni]=1;}
        }
      }
      return [from.clone(), to.clone()];
    }

    function botMoveTo(bot:any,target:THREE.Vector3,dt:number,speed=3.2){
      const flatDist=Math.hypot(bot.obj.position.x-target.x,bot.obj.position.z-target.z);
      if(flatDist<0.36){
        bot.navState.currentPath = [];
        bot.navState.pathIndex = 0;
        return true;
      }
      if(flatDist<5.5&&lineClear2D(bot.obj.position,target,0.42)){
        bot.navState.currentPath = [];
        bot.navState.pathIndex = 0;
        return botMoveDirect(bot,target,dt,speed);
      }
      
      const now=performance.now()/1000;
      const goalChanged=!bot.navGoal||bot.navGoal.distanceToSquared(target)>5.2;
      
      // stuck check and path updates
      const navUpdate = updateNavState(bot.navState, bot.obj.position, dt);
      
      if(goalChanged||!bot.navState.currentPath.length||now>bot.navRepathAt||navUpdate.repath){
        bot.navGoal=target.clone();
        if (navGraph) {
          const targetSite = state.attackSite === 'A' || state.attackSite === 'B' ? state.attackSite : undefined;
          const pathRes = findPath(navGraph, bot.obj.position, target, targetSite);
          
          if (pathRes.nodeIds.length > 0) {
            const nextNodeId = pathRes.nodeIds[0];
            const sharedChokes = (window as any).__SHARED_CHOKEPOINTS__ || new Map();
            if (navGraph.chokepoints.has(nextNodeId)) {
              if (!isChokepointAvailable(navGraph, nextNodeId, bot.id, sharedChokes)) {
                // clustering check: slow down
                speed *= 0.25;
              } else {
                sharedChokes.set(nextNodeId, bot.id);
                (window as any).__SHARED_CHOKEPOINTS__ = sharedChokes;
              }
            }
          }
          
          bot.navState.currentPath = navSmoothPath(pathRes.path);
          bot.navState.currentNodeIds = pathRes.nodeIds;
          bot.navState.pathIndex = 0;
        } else {
          bot.navState.currentPath = [target.clone()];
          bot.navState.pathIndex = 0;
        }
        bot.navRepathAt=now+rand(0.45,0.82);
      }
      
      const nextWp = bot.navState.currentPath[bot.navState.pathIndex] || target;
      const wp = new THREE.Vector3(nextWp.x, nextWp.y, nextWp.z);
      
      if(bot.navState.pathIndex >= bot.navState.currentPath.length && bot.obj.position.distanceTo(wp)<0.85){
        bot.navState.currentPath = [];
        return true;
      }
      return botMoveDirect(bot,wp,dt,speed);
    }

    function botShootAtTarget(bot:any, aimAt:THREE.Vector3, dt:number){
      const w=WEAPONS[bot.weapon];
      if(bot.reloadT > 0) return;
      if(bot.ammoMag <= 0) {
        bot.reloadT = w.reload;
        return;
      }
      
      // Burst discipline for auto weapons
      if(w.auto&&bot.burstRest>0){bot.burstRest-=dt;return;}
      bot.fireCD-=dt;
      bot.reactionT=Math.max(0,bot.reactionT-dt);
      if(bot.fireCD>0||bot.reactionT>0)return;
      
      // Only shoot if aim is on target!
      let threshold = 0.09;
      if (bot.difficulty === 'easy') threshold = 0.22;
      else if (bot.difficulty === 'medium') threshold = 0.15;
      else if (bot.difficulty === 'hard') threshold = 0.08;
      else if (bot.difficulty === 'pro') threshold = 0.04;
      
      if (!isAimReady(bot.aimState, threshold)) return;
      
      const eye=bot.obj.position.clone(); eye.y+=1.45;
      const dist=eye.distanceTo(aimAt);
      
      // Calculate spread using difficulty params
      const params = AIM_DIFFICULTY_PARAMS[bot.difficulty as AimDifficulty] || AIM_DIFFICULTY_PARAMS.medium;
      let spread = w.spread + (1 - params.burstAccuracy) * 0.015 + clamp(dist/85,0,1)*0.018;
      const scoped=Boolean(w.scoped&&dist>18&&bot.combatSnapshot.state==='engaging');
      if(scoped) spread*=0.22; else if(w.scoped) spread*=5;
      
      bot.fireCD=w.cd*rand(0.88,1.18);
      bot.ammoMag--;
      bot.shotCount++;
      
      playGunshot(bot.weapon);
      emitSoundEvent(bot.team, eye, 'gunshot', w.scoped ? 1.15 : 1);
      
      // Spawn point light muzzle flash
      const dir=bot.aimDir.clone();
      dir.x+=(Math.random()-.5)*spread;dir.y+=(Math.random()-.5)*spread;dir.z+=(Math.random()-.5)*spread;dir.normalize();
      spawnMuzzleFlashLight(eye, dir);
      
      // Burst control: SMGs/rifles fire 3-5 round bursts
      if(w.auto&&bot.shotCount%(3+Math.floor(params.burstAccuracy*3))===0) {
        bot.burstRest=rand(0.08,0.22);
      }
      
      const hit=shootRay(eye,dir,w.range,bot);
      spawnTracer(eye,hit?hit.point:eye.clone().add(dir.clone().multiplyScalar(w.range)),bot.team==='CT'?0x9ad7ff:0xffd59c);
      
      if(hit){
        if(hit.isPlayer) {
          const dmgRes = computeDamage({
            baseDamage: w.scoped && !scoped ? w.dmg * 0.92 : w.dmg,
            bodyPart: hit.part as BodyPart,
            armorPenetration: w.armorPen ?? 0.7,
            targetArmor: player.armor,
            targetHasHelmet: player.helmet,
            distance: hit.dist,
            maxRange: w.range,
          });
          damagePlayerWithDetails(dmgRes.damage, dmgRes.remainingArmor, bot, w, hit.part);
        }
        else if(hit.bot&&hit.bot.team!==bot.team) {
          const dmgRes = computeDamage({
            baseDamage: w.scoped && !scoped ? w.dmg * 0.92 : w.dmg,
            bodyPart: hit.part as BodyPart,
            armorPenetration: w.armorPen ?? 0.7,
            targetArmor: hit.bot.armor,
            targetHasHelmet: hit.bot.helmet,
            distance: hit.dist,
            maxRange: w.range,
          });
          applyDamageToBot(hit.bot, dmgRes.damage, dmgRes.remainingArmor, w, bot, hit.part, hit.point);
        }
        else if(hit.isWall) spawnImpact(hit.point,0x33271d);
      }
      
      bot.reactionT=rand(0.03,0.14)+(1-params.burstAccuracy)*0.1;
    }

    function followRoute(bot:any,dt:number,speed=3.2){
      if(!bot.route.length)return true;
      const idx=clamp(bot.routeIndex,0,bot.route.length-1);
      const t=bot.route[idx];
      const arrived=botMoveTo(bot,t,dt,speed);
      if((arrived||bot.obj.position.distanceTo(t)<1.4)&&bot.routeIndex<bot.route.length-1)bot.routeIndex++;
      return bot.routeIndex>=bot.route.length-1&&(arrived||bot.obj.position.distanceTo(t)<1.8);
    }

    function setAiState(bot:any,newState:string){
      bot.prevAiState=bot.aiState; bot.aiState=newState; bot.stateT=0;
    }

    // CT peek positions: corners of common angles they watch
    const CT_PEEK_ANGLES: Record<string,THREE.Vector3[]> = {
      A_ANCHOR:[vec(-36,0,-16),vec(-26,0,-18)],
      B_ANCHOR:[vec(34,0,-24),vec(26,0,-26)],
      MID:[vec(-4,0,-18),vec(4,0,-14),vec(12,0,-12)],
      FLOAT:[vec(12,0,16),vec(22,0,8)],
    };
    // T rush waypoints after bomb plant
    function sitePostPlantPositions(site:string){
      return site==='A'
        ?[vec(-38,0,-8),vec(-28,0,-16),vec(-22,0,-6)]
        :[vec(38,0,-14),vec(30,0,-26),vec(20,0,-16)];
    }
    function siteRetakePositions(site:string){
      return site==='A'
        ?[vec(-18,0,-8),vec(-22,0,-18),vec(-8,0,-10)]
        :[vec(18,0,-10),vec(24,0,-22),vec(10,0,-14)];
    }

    function findCoverFrom(bot:any,threat:THREE.Vector3){
      ensureNavGrid();
      const threatEye=threat.clone();threatEye.y+=1.45;
      let best:THREE.Vector3|null=null,bestScore=-999;
      for(let r=2.4;r<=11;r+=2.2){
        for(let a=0;a<Math.PI*2;a+=Math.PI/6){
          const p=vec(bot.obj.position.x+Math.cos(a)*r,0,bot.obj.position.z+Math.sin(a)*r);
          if(blockedAt(p.x,p.z,0.48))continue;
          const pEye=p.clone();pEye.y+=1.45;
          if(losClear(threatEye,pEye))continue;
          const anchor=bot.anchor||p;
          const score=p.distanceTo(threat)*0.38-p.distanceTo(bot.obj.position)*0.22-p.distanceTo(anchor)*0.08+(lineClear2D(bot.obj.position,p,0.42)?1.1:0);
          if(score>bestScore){bestScore=score;best=p;}
        }
      }
      return best;
    }

    function updateBot(bot:any,dt:number){
      if(!bot.alive)return;
      const w=WEAPONS[bot.weapon];
      bot.stateT+=dt;
      bot.lastSeenT+=dt;
      bot.heardSoundAge+=dt;
      bot.damagedT+=dt;

      // Freeze phase: just stand there
      if(state.phase==='freeze'){
        bot.combatSnapshot.state = 'patrolling';
        return;
      }

      // Look for enemies (staggered time-sliced perception: 1/3 bots per tick or missing cache)
      const botIdx = bots.indexOf(bot);
      let enemy = bot.targetEnemy;
      if (tickCount % 3 === (botIdx >= 0 ? botIdx % 3 : 0) || !enemy || !enemy.ent || (enemy.ent.hp !== undefined && enemy.ent.hp <= 0)) {
        enemy = findEnemy(bot);
        bot.targetEnemy = enemy;
      }

      if (!bot.profile) {
        bot.profile = createBotProfile(bot.difficulty || 'medium');
        bot.peekDiscipline = bot.profile.peekDiscipline;
        bot.utilityBaitChance = bot.profile.utilityBaitChance;
      }
      const objectivePos = state.bomb?.pos ?? (state.attackSite==='A' ? A_SITE : B_SITE);
      const nearbyAllies =
        bots.filter(
          (ally) =>
            ally !== bot &&
            ally.alive &&
            ally.team === bot.team &&
            ally.obj.position.distanceTo(bot.obj.position) < 12,
        ).length +
        (player.alive && player.team === bot.team && player.pos.distanceTo(bot.obj.position) < 12 ? 1 : 0);
        
      const blackboard = updateBotBlackboard({
        botTeam: bot.team as Team,
        botPosition: bot.obj.position,
        hp: bot.hp,
        ammoRatio: Math.max(0, Math.min(1, bot.ammoMag / Math.max(1, w.magSize || 1))),
        distanceToObjective: bot.obj.position.distanceTo(objectivePos),
        visibleEnemies: enemy ? 1 : 0,
        nearbyAllies,
        hasBomb: bot.hasBomb,
        bombPlanted: Boolean(state.bomb),
        soundAwareness: bot.soundAwareness ?? 0.5,
        recentDamageAge: bot.damagedT,
        visibleEnemyPosition: enemy
          ? { x: enemy.pos.x, y: enemy.pos.y, z: enemy.pos.z }
          : undefined,
        previousEnemyMemory: bot.enemyMemory,
        audibleEvents: soundEvents,
        dt,
      });
      bot.enemyMemory = blackboard.enemyMemory;
      bot.danger = blackboard.danger;
      bot.lastDecision = blackboard.decision;
      if(blackboard.heardThreat){
        bot.heardSoundPos = vec(
          blackboard.heardThreat.position.x,
          blackboard.heardThreat.position.y,
          blackboard.heardThreat.position.z,
        );
        bot.heardSoundAge = blackboard.heardThreat.age;
      } else if(bot.heardSoundAge > 6) {
        bot.heardSoundPos = null;
      }
      if(!enemy && bot.enemyMemory){
        bot.lastSeenPos = vec(
          bot.enemyMemory.lastKnownPosition.x,
          bot.enemyMemory.lastKnownPosition.y,
          bot.enemyMemory.lastKnownPosition.z,
        );
        bot.lastSeenT = Math.min(bot.lastSeenT, bot.enemyMemory.age);
      }
      if(!enemy && bot.heardSoundPos && bot.heardSoundAge < 4.5 && bot.lastDecision === 'investigate-sound'){
        bot.lastSeenPos = bot.heardSoundPos.clone();
        bot.lastSeenT = Math.min(bot.lastSeenT, bot.heardSoundAge);
      }
      
      // Update bot ammo and reloading logic using BotEconomy
      const inv = {
        weapon: bot.weapon,
        credits: bot.money || 0,
        ammoMag: bot.ammoMag,
        ammoReserve: bot.ammoReserve !== undefined ? bot.ammoReserve : 90,
        armor: bot.armor,
        helmet: bot.helmet,
        isReloading: bot.reloadT > 0,
        reloadTimeRemaining: bot.reloadT,
      };
      
      const nearestNode = navGraph ? findNearestNode(navGraph, bot.obj.position) : null;
      const coverScore = nearestNode ? nearestNode.coverScore : 0.5;
      
      // Auto-reload check
      if (shouldBotReload(inv, coverScore > 0.5, !!enemy)) {
        bot.reloadT = w.reload;
      }
      
      const updatedInv = updateBotAmmo(inv, dt, w.reload, w.magSize);
      bot.ammoMag = updatedInv.ammoMag;
      bot.ammoReserve = updatedInv.ammoReserve;
      bot.reloadT = updatedInv.reloadTimeRemaining;
      
      // Update combat context
      const context: CombatContext = {
        hp: bot.hp,
        maxHp: 100,
        ammoMag: bot.ammoMag,
        magSize: w.magSize,
        hasLineOfSight: !!enemy,
        distanceToEnemy: enemy ? enemy.dist : 9999,
        lastKnownEnemyAge: bot.lastSeenT,
        coverScore: coverScore,
        nearestCoverScore: 0.7,
        hasBomb: bot.hasBomb,
        bombPlanted: !!state.bomb,
        isOnBombSite: bot.obj.position.distanceTo(state.attackSite === 'A' ? A_SITE : B_SITE) < 6.0,
        team: bot.team as 'CT' | 'T',
        difficulty: bot.difficulty,
        suppressionTimer: bot.combatSnapshot.suppressionTimer,
      };

      // Advance combat state
      bot.combatSnapshot = advanceCombatState(bot.combatSnapshot, context, dt);
      
      const enemyId = enemy ? (enemy.ent.isPlayer ? 'player' : enemy.ent.id) : null;
      const threatId = enemyId || (bot.lastSeenPos && bot.lastSeenT < 5 ? 'lastSeen' : (bot.heardSoundPos && bot.heardSoundAge < 4.5 ? 'heardSound' : null));

      // Determine target angle for aim simulator
      let desiredTargetAngle = { x: 0, y: bot.obj.rotation.y };
      if (enemy) {
        const eye = bot.obj.position.clone(); eye.y += 1.45;
        const toEnemy = enemy.pos.clone().sub(eye);
        const dist2d = Math.sqrt(toEnemy.x * toEnemy.x + toEnemy.z * toEnemy.z);
        const yaw = Math.atan2(-toEnemy.x, -toEnemy.z);
        const pitch = Math.atan2(toEnemy.y, dist2d);
        desiredTargetAngle = { x: pitch, y: yaw };
      } else if (bot.lastSeenPos && bot.lastSeenT < 5) {
        const eye = bot.obj.position.clone(); eye.y += 1.45;
        const toPos = bot.lastSeenPos.clone().sub(eye);
        const dist2d = Math.sqrt(toPos.x * toPos.x + toPos.z * toPos.z);
        const yaw = Math.atan2(-toPos.x, -toPos.z);
        const pitch = Math.atan2(toPos.y, dist2d);
        desiredTargetAngle = { x: pitch, y: yaw };
      } else if (bot.heardSoundPos && bot.heardSoundAge < 4.5) {
        const eye = bot.obj.position.clone(); eye.y += 1.45;
        const toPos = bot.heardSoundPos.clone().sub(eye);
        const dist2d = Math.sqrt(toPos.x * toPos.x + toPos.z * toPos.z);
        const yaw = Math.atan2(-toPos.x, -toPos.z);
        const pitch = Math.atan2(toPos.y, dist2d);
        desiredTargetAngle = { x: pitch, y: yaw };
      }

      // Check if we are aiming at a different target or a new threat
      if (threatId) {
        if (bot.lastThreatId !== threatId) {
          bot.aimState = setTarget(bot.aimState, desiredTargetAngle, bot.difficulty);
          bot.lastThreatId = threatId;
        } else {
          // Just update the target angle dynamically without resetting the reaction timer
          bot.aimState.targetAngle = desiredTargetAngle;
        }
      } else {
        bot.lastThreatId = null;
        bot.aimState.targetAngle = desiredTargetAngle;
      }
      
      // Update aim state
      bot.aimState = updateAim(bot.aimState, dt, bot.difficulty);
      const cp = bot.aimState.currentAngle.x;
      const cy = bot.aimState.currentAngle.y;
      
      // Update bot rotation and spine bone
      if (shouldMove(bot.combatSnapshot) && bot.navState.currentPath.length > 0) {
        if (bot.spine) {
          let relYaw = cy - bot.obj.rotation.y;
          relYaw = Math.atan2(Math.sin(relYaw), Math.cos(relYaw));
          const maxTwist = 50 * Math.PI / 180;
          relYaw = Math.max(-maxTwist, Math.min(maxTwist, relYaw));
          bot.spine.rotation.y = relYaw;
        }
        if (bot.head) {
          bot.head.rotation.set(cp, 0, 0);
        }
      } else {
        bot.obj.rotation.y = cy;
        if (bot.spine) bot.spine.rotation.y = 0;
        if (bot.head) bot.head.rotation.set(cp, 0, 0);
      }

      // Update bot aim direction vector
      bot.aimDir.set(0, 0, -1).applyEuler(new THREE.Euler(cp, cy, 0, 'YXZ')).normalize();

      // Execute action depending on combat state
      const stateName = bot.combatSnapshot.state;
      
      if (stateName === 'engaging' && enemy) {
        const aimAt = enemy.pos.clone();
        aimAt.y += enemy.ent.isPlayer ? 1.32 : 1.42;
        
        // Strafe and fight logic
        const toEnemy = enemy.pos.clone().sub(bot.obj.position); toEnemy.y = 0;
        const dist = toEnemy.length();
        
        if (w.scoped) {
          if (dist < 12) {
            const back = bot.obj.position.clone().sub(toEnemy.normalize().multiplyScalar(2));
            botMoveTo(bot, back, dt, 2.8);
          } else {
            const side = vec(-toEnemy.z, 0, toEnemy.x).normalize().multiplyScalar(Math.sin(performance.now() * 0.0015 + bot.strafeSeed) * 1.2);
            botMoveTo(bot, bot.obj.position.clone().add(side), dt, 1.8);
          }
        } else if (dist > 20 && bot.aggression > 0.6) {
          const side = vec(-toEnemy.z, 0, toEnemy.x).normalize().multiplyScalar(Math.sin(performance.now() * 0.0024 + bot.strafeSeed) * 1.5);
          botMoveTo(bot, enemy.pos.clone().add(side), dt, w.moveSpeed * 0.62);
        } else if (dist > 8) {
          const sideDir = vec(-toEnemy.z, 0, toEnemy.x).normalize();
          const sideAmt = Math.sin(performance.now() * 0.005 + bot.strafeSeed) * (1.6 + bot.aggression);
          botMoveTo(bot, bot.obj.position.clone().add(sideDir.multiplyScalar(sideAmt)), dt, w.moveSpeed * 0.5);
        } else {
          const back = bot.obj.position.clone().sub(toEnemy.normalize().multiplyScalar(1.2));
          botMoveTo(bot, back, dt, w.moveSpeed * 0.45);
        }
        
        botShootAtTarget(bot, aimAt, dt);
        
        if (bot.hp < 40 && coverScore > 0.6) {
          bot.retreatPos = findCoverFrom(bot, enemy.pos) || bot.anchor.clone();
        }
        return;
      }
      
      if (stateName === 'suppressing') {
        const suppressPos = bot.lastSeenPos ? bot.lastSeenPos.clone() : (bot.heardSoundPos ? bot.heardSoundPos.clone() : null);
        if (suppressPos) {
          suppressPos.y += 1.42;
          botShootAtTarget(bot, suppressPos, dt);
        }
        return;
      }
      
      if (stateName === 'retreating') {
        const targetPos = bot.retreatPos || findCoverFrom(bot, bot.lastSeenPos || bot.obj.position) || bot.anchor;
        botMoveTo(bot, targetPos, dt, w.moveSpeed * 0.7);
        return;
      }
      
      if (stateName === 'reloading') {
        const coverPos = findCoverFrom(bot, bot.lastSeenPos || bot.obj.position) || bot.anchor;
        botMoveTo(bot, coverPos, dt, w.moveSpeed * 0.5);
        return;
      }
      
      if (stateName === 'investigating') {
        const searchPos = bot.lastSeenPos || bot.heardSoundPos;
        if (searchPos) {
          botMoveTo(bot, searchPos, dt, w.moveSpeed * 0.55);
        }
        return;
      }
      
      if (stateName === 'planting') {
        const site = state.attackSite === 'A' ? A_SITE : B_SITE;
        const dist = bot.obj.position.distanceTo(site);
        if (dist < 3.8) {
          bot.plantT += dt;
          if (bot.plantT > 3.4) {
            plantBomb(bot.obj.position.clone(), bot);
            bot.plantT = 0;
          }
        } else {
          botMoveTo(bot, site, dt, w.moveSpeed * 0.68);
          bot.plantT = 0;
        }
        return;
      }
      
      if (stateName === 'defusing') {
        if (state.bomb) {
          const dist = bot.obj.position.distanceTo(state.bomb.pos);
          if (dist < 2.0) {
            bot.defuseT += dt;
            if (bot.defuseT > 5) {
              if (state.bomb.mesh) {
                scene.remove(state.bomb.mesh);
                disposeObject3DResources(state.bomb.mesh);
              }
              state.bomb = null;
              endRound('CT', 'Bomb defused');
              bot.defuseT = 0;
            }
          } else {
            botMoveTo(bot, state.bomb.pos, dt, w.moveSpeed * 0.65);
            bot.defuseT = 0;
          }
        }
        return;
      }
      
      // Default / patrolling behaviors (CT and T specific route planning)
      if (bot.team === 'T') {
        if (droppedBomb && !bot.hasBomb && !bots.some(b => b.alive && b.hasBomb)) {
          if (bot.obj.position.distanceTo(droppedBomb.pos) < 1.4) {
            bot.hasBomb = true;
            droppedBomb = null;
            if (droppedBombMesh) {
              scene.remove(droppedBombMesh);
              disposeObject3DResources(droppedBombMesh);
              droppedBombMesh = null;
            }
          } else {
            botMoveTo(bot, droppedBomb.pos, dt, w.moveSpeed * 0.65);
            return;
          }
        }
        
        if (state.bomb) {
          const holds = sitePostPlantPositions(state.attackSite);
          const hold = holds[(bot.role.charCodeAt(0) + bot.name.length) % holds.length];
          botMoveTo(bot, hold, dt, w.moveSpeed * 0.6);
          return;
        }
        
        if (bot.hasBomb) {
          if (bot.rushDelay > 0) {
            bot.rushDelay -= dt;
            return;
          }
          const site = state.attackSite === 'A' ? A_SITE : B_SITE;
          botMoveTo(bot, site, dt, w.moveSpeed * 0.68);
          return;
        }
        
        if (bot.route.length) {
          if (bot.rushDelay > 0) {
            bot.rushDelay -= dt;
            return;
          }
          followRoute(bot, dt, w.moveSpeed * 0.65);
          return;
        }
      } else {
        const peekAnglePts = CT_PEEK_ANGLES[bot.role] || [];
        const shouldPeek = peekAnglePts.length > 0 && bot.stateT > rand(3, 6) * (1 + (bot.peekDiscipline ?? 0.5) * 0.35) && bot.aiState === 'hold';
        if (shouldPeek) {
          bot.aiState = 'peek';
          bot.coverPos = peekAnglePts[Math.floor(Math.random() * peekAnglePts.length)];
          bot.stateT = 0;
        }
        if (bot.aiState === 'peek' && bot.coverPos) {
          botMoveTo(bot, bot.coverPos, dt, w.moveSpeed * 0.55);
          if (bot.stateT > 2.0) {
            bot.aiState = 'hold';
            bot.stateT = 0;
          }
          return;
        }
        
        const idleOff = vec(Math.sin(performance.now() * 0.0014 + bot.strafeSeed) * 0.8, 0, Math.cos(performance.now() * 0.0009 + bot.strafeSeed) * 0.5);
        botMoveTo(bot, bot.anchor.clone().add(idleOff), dt, w.moveSpeed * 0.45);
      }
    }

    function handleInteractions(dt:number,ce:boolean){
      dom.defuse.style.display='none';
      if(dom.plant)dom.plant.style.display='none';
      dom.actionPrompt.style.display='none';
      const nw=nearestDroppedWeapon();
      if(nw&&ce){
        dom.actionPrompt.textContent=`PRESS E TO PICK UP ${WEAPONS[nw.id].name}`;
        dom.actionPrompt.style.display='block';
        if(interactPressed){pickupWeapon(nw);interactPressed=false;return;}
      }
      // T-player: pick up dropped bomb
      if(player.team==='T'&&!player.hasBomb&&droppedBomb&&player.alive){
        const db=droppedBombMesh;
        if(db&&player.pos.distanceTo(db.position)<2.0){
          dom.actionPrompt.textContent='PRESS E TO PICK UP BOMB';dom.actionPrompt.style.display='block';
          if(interactPressed){player.hasBomb=true;scene.remove(droppedBombMesh!);disposeObject3DResources(droppedBombMesh!);droppedBombMesh=null;droppedBomb=null;interactPressed=false;return;}
        }
      }
      // T-player: plant bomb
      if(player.team==='T'&&player.hasBomb&&player.alive&&state.phase==='live'){
        const site=state.attackSite==='A'?A_SITE:B_SITE;
        if(player.pos.distanceTo(site)<4.2){
          dom.actionPrompt.textContent='HOLD E TO PLANT BOMB';dom.actionPrompt.style.display='block';
          if(ce&&keys.KeyE){
            state.plantingT=(state.plantingT||0)+dt;
            if(dom.plant)dom.plant.style.display='block';
            if(dom.plantBar)dom.plantBar.style.width=`${clamp(state.plantingT/3.2,0,1)*100}%`;
            if(state.plantingT>=3.2){plantBomb(player.pos.clone(),{name:playerNameRef.current,team:'T'});player.hasBomb=false;}
          } else state.plantingT=0;
          return;
        }
      }
      state.plantingT=0;
      // CT-player: defuse
      if(player.team==='CT'&&state.bomb&&player.alive){
        const d=player.pos.distanceTo(state.bomb.pos);
        if(d<2.2){
          const dt2=player.hasKit?3.5:5;
          dom.actionPrompt.textContent=`HOLD E TO DEFUSE${player.hasKit?' · KIT':''}`;
          dom.actionPrompt.style.display='block';
          if(ce&&keys.KeyE){
            state.defusingT+=dt;dom.defuse.style.display='block';
            dom.defuseBar.style.width=`${clamp(state.defusingT/dt2,0,1)*100}%`;
            if(state.defusingT>=dt2){if(state.bomb?.mesh){scene.remove(state.bomb.mesh);disposeObject3DResources(state.bomb.mesh);}state.bomb=null;endRound('CT','Bomb defused');}
          } else state.defusingT=0;
          return;
        }
      }
      state.defusingT=0;
    }

    // ─── ROUND MANAGEMENT ───────────────────────────────────────────────────────
    function startRound(){
      state.phase='freeze';state.phaseT=11;state.defusingT=0;state.plantingT=0;
      state.attackSite=Math.random()<0.5?'A':'B';
      state.specTarget=null;
      soundEvents=[];
      player.roundKills = 0; player.roundHeadshots = 0;
      player.inspecting = false; player.inspectT = 0;
      if (dom.mvpCard) dom.mvpCard.classList.remove('show');
      if (dom.killstreak) dom.killstreak.classList.remove('show');
      dom.roundEnd.style.display='none';dom.bombIcon.classList.remove('armed');
      if(dom.plant)dom.plant.style.display='none';
      clearDroppedWeapons();clearBombWorld();
      // Team-aware spawn & loadout
      const pTeam=player.team||'CT';
      if(pTeam==='T'){
        const target = new THREE.Vector3(state.attackSite==='A' ? -28 : -16, T_SPAWN_POS.y, T_SPAWN_POS.z);
        const safe = findSafeSpawn(target, EYE);
        player.pos.copy(safe);
        player.yaw = 0.48;
      } else {
        const target = CT_SPAWN_POS.clone();
        const safe = findSafeSpawn(target, EYE);
        player.pos.copy(safe);
        player.yaw = -0.35;
      }
      player.vel.set(0,0,0);
      // Compute onGround by checking proximity to collider tops or floor
      const footY = player.pos.y - EYE;
      let onGroundGuess = false;
      for (const c of colliders) {
        if (player.pos.x > c.min.x - 0.34 && player.pos.x < c.max.x + 0.34 && player.pos.z > c.min.z - 0.34 && player.pos.z < c.max.z + 0.34) {
          if (Math.abs(footY - c.max.y) <= 0.12) { onGroundGuess = true; break; }
        }
      }
      if (!onGroundGuess && footY <= CT_SPAWN_POS.y + 0.05) onGroundGuess = true;
      player.onGround = onGroundGuess;
      player.hp=100;player.alive=true;player.scoped=false;player.crouch=false;player.jumpLock=false;player.jumpBuffer=0;
      player.stepNoiseCd=0;
      player.hasBomb=false;
      cancelReload();mouseDown=false;mousePressed=false;interactPressed=false;
      dom.defuseBar.style.width='0%';dom.actionPrompt.style.display='none';
      const defSidearm=pTeam==='T'?'glock':'usp';
      if(!player.inventory.sidearm)grantWeapon(defSidearm);
      if(state.round===1){player.money=800;player.armor=0;player.helmet=false;player.hasKit=false;
        player.inventory={knife:'knife',sidearm:defSidearm,primary:null};player.ammo={};ensureAmmo(defSidearm);}
      equipWeapon(player.inventory.primary||player.inventory.sidearm||'knife');
      clearBots();configureBots();buildBuyMenu();updateHUD();
    }

    function endRound(winner:string,reason:string){
      if(state.phase==='end'||state.matchOver)return;
      state.frozenRoundTime = state.phase==='planted'&&state.bomb ? state.bomb.timer : state.phaseT;
      state.phase='end';state.phaseT=4.5;
      stopBombBeep();
      // CS2 economy: loss bonus escalates 1400/1900/2400/2900/3400
      const lossBonusTable = [1400, 1900, 2400, 2900, 3400];
      if(winner==='CT'){state.ctLossStreak=0;state.tLossStreak=Math.min(4,state.tLossStreak+1);}
      else{state.tLossStreak=0;state.ctLossStreak=Math.min(4,state.ctLossStreak+1);}
      const playerWon = winner === player.team;
      if(playerWon){
        player.money=Math.min(16000,player.money+3250);
      } else {
        const streak = player.team==='CT'?state.ctLossStreak:state.tLossStreak;
        player.money=Math.min(16000,player.money+lossBonusTable[Math.min(streak,4)]);
      }

      // Update persistent stats for bots
      for (const bot of bots) {
        const stats = persistentBotStats.get(bot.name) || { kills: bot.kills, deaths: bot.deaths, money: bot.money || 800 };
        stats.kills = bot.kills;
        stats.deaths = bot.deaths;
        
        // Award money to bot
        const botWon = winner === bot.team;
        if (botWon) {
          stats.money = Math.min(16000, stats.money + 3250);
        } else {
          const streak = bot.team === 'CT' ? state.ctLossStreak : state.tLossStreak;
          stats.money = Math.min(16000, stats.money + lossBonusTable[Math.min(streak, 4)]);
        }
        persistentBotStats.set(bot.name, stats);
      }

      // Compute MVP Card
      let mvpName = 'Team Synergy';
      let mvpReason = 'Tactical Execution';
      if (player.roundKills > 0) {
        mvpName = playerNameRef.current;
        mvpReason = `FOR ${player.roundKills} ELIMINATIONS (${player.roundHeadshots} HEADSHOTS)`;
      } else {
        const topBot = bots.filter(b => b.team === winner).sort((a,b) => b.kills - a.kills)[0];
        if (topBot && topBot.kills > 0) {
          mvpName = topBot.name;
          mvpReason = `FOR MOST ELIMINATIONS IN ROUND`;
        }
      }
      showMvpCard(winner, mvpName, mvpReason);
      audioSystem.playAnnouncerVoice(winner === 'CT' ? 'ctWin' : 'tWin');

      // Track round history
      state.roundHistory.push({winner});
      dom.roundEnd.style.display='block';
      dom.roundWinner.textContent=`${winner} WIN`;
      dom.roundWinner.style.color=winner==='CT'?'#87b9ff':'#f0a366';
      dom.roundReason.textContent=reason;
      if(winner==='CT')state.ctScore++;else state.tScore++;
      if(reason==='Bomb defused')playDefuseSuccess();
      updateHUD();
      if(state.ctScore>=8||state.tScore>=8||state.round>=state.maxRounds){
        state.matchOver=true;state.started=false;
        const fw=state.ctScore>state.tScore?'CT':'T';
        dom.roundWinner.textContent=`${fw} MATCH`;
        dom.roundWinner.style.color=fw==='CT'?'#87b9ff':'#f0a366';
        dom.roundReason.textContent=`FINAL ${state.ctScore}-${state.tScore} · refresh to replay`;
      }
    }

    function updateDroppedWeapons(dt:number){
      const t=performance.now()/1000;
      for(const d of droppedWeapons){
        const baseY = d.baseY !== undefined ? d.baseY : 0;
        d.group.position.y=baseY + 0.16 + Math.sin(t*2.4+d.bobSeed)*0.03;
        d.group.rotation.y+=dt*0.24;
      }
      if(droppedBombMesh){
        const baseY = droppedBomb ? droppedBomb.baseY : 0;
        droppedBombMesh.rotation.y+=dt*0.8;
        droppedBombMesh.position.y=baseY + 0.14+Math.sin(t*2.8)*0.03;
      }
    }

    // ─── HUD ────────────────────────────────────────────────────────────────────
    function renderScoreboard(){
      const view = buildScoreboardView({
        round: state.round,
        maxRounds: state.maxRounds,
        score: { CT: state.ctScore, T: state.tScore },
        playerName: playerNameRef.current || 'Player',
        playerTeam: player.team,
        playerMoney: player.money,
        playerHasBomb: player.hasBomb,
        rows: [
          {
            team: player.team,
            name: `${playerNameRef.current || 'Player'} (YOU)`,
            hp: player.hp,
            alive: player.alive,
            weaponName: WEAPONS[player.weapon]?.name || player.weapon,
            kills: player.kills,
            deaths: player.deaths,
            money: player.money,
            hasBomb: player.hasBomb,
          },
          ...bots.map((bot) => ({
            team: bot.team,
            name: bot.name,
            hp: bot.hp,
            alive: bot.alive,
            weaponName: WEAPONS[bot.weapon]?.name || bot.weapon,
            kills: bot.kills,
            deaths: bot.deaths,
            money: null,
            hasBomb: bot.hasBomb,
          })),
          ...Array.from(remotePlayers.values()).map((remote) => ({
            team: remote.team,
            name: remote.name,
            hp: remote.hp,
            alive: remote.hp > 0,
            weaponName: WEAPONS[remote.weapon]?.name || remote.weapon,
            kills: 0,
            deaths: 0,
            money: null,
            hasBomb: false,
          })),
        ],
      });

      const title = document.createElement('div');
      title.className = 'game-score-title';
      const roundLabel = document.createElement('span');
      roundLabel.textContent = `ROUND ${view.round} / ${view.maxRounds}`;
      title.append('MATCH SCOREBOARD', roundLabel);

      const createTeamBlock = (team: Team) => {
        const section = document.createElement('section');
        section.className = 'game-score-team';
        section.style.setProperty('--team', view.teams[team].color);

        const header = document.createElement('header');
        const label = document.createElement('strong');
        label.textContent = view.teams[team].label;
        const score = document.createElement('b');
        score.textContent = String(view.teams[team].score);
        header.append(label, score);

        const head = document.createElement('div');
        head.className = 'game-score-head';
        for (const text of ['PLAYER', 'K', 'D', 'HP', 'WEAPON', '$']) {
          const cell = document.createElement('span');
          cell.textContent = text;
          head.appendChild(cell);
        }

        section.append(header, head);

        for (const row of view.teams[team].rows) {
          const rowEl = document.createElement('div');
          rowEl.className = `game-score-row ${row.alive ? '' : 'dead'}`.trim();

          const name = document.createElement('span');
          name.className = 'game-score-name';
          name.textContent = `${row.prefix}${row.name}`;

          const kills = document.createElement('span');
          kills.textContent = String(row.kills);
          const deaths = document.createElement('span');
          deaths.textContent = String(row.deaths);
          const hp = document.createElement('span');
          hp.textContent = row.displayHp;
          const weapon = document.createElement('span');
          weapon.textContent = row.weaponName;
          const money = document.createElement('span');
          money.textContent = row.displayMoney;

          rowEl.append(name, kills, deaths, hp, weapon, money);
          section.appendChild(rowEl);
        }

        return section;
      };

      dom.scoreboard.replaceChildren(title, createTeamBlock('CT'), createTeamBlock('T'));
    }

    function updateHUD(){
      dom.hp.textContent=String(Math.max(0,Math.round(player.hp)));
      const tags=[];if(player.helmet)tags.push('HELM');if(player.hasKit)tags.push('KIT');
      dom.armor.textContent=`· ${Math.round(player.armor)} ARMOR${tags.length?` · ${tags.join(' · ')}`:''}`; 
      dom.money.textContent=String(player.money);
      dom.ctScore.textContent=String(state.ctScore);dom.tScore.textContent=String(state.tScore);
      dom.ctAlive.textContent=String((player.alive&&player.team==='CT'?1:0)+bots.filter(b=>b.alive&&b.team==='CT').length);
      dom.tAlive.textContent=String((player.alive&&player.team==='T'?1:0)+bots.filter(b=>b.alive&&b.team==='T').length);
      const w=activeWeapon();
      dom.weaponName.textContent=w.name+(w.scoped&&player.scoped?' · ZOOM':'');
      const ammoView = w.type === 'melee'
        ? buildAmmoView({ type: 'melee' })
        : buildAmmoView({
            type: 'gun',
            mag: ammoFor(player.weapon).mag,
            reserve: ammoFor(player.weapon).reserve,
            reloading: player.reloading,
          });
      dom.ammoPrimary.textContent = ammoView.primary;
      dom.ammoReserve.textContent = ammoView.reserve;
      dom.ammoReserve.style.display = ammoView.reserve ? 'inline' : 'none';
      if(state.bomb){dom.bombIcon.textContent='◆ BOMB ARMED';dom.bombIcon.style.display='block';dom.bombIcon.classList.add('armed');}
      else if(droppedBomb){dom.bombIcon.textContent='◆ BOMB DOWN';dom.bombIcon.style.display='block';dom.bombIcon.classList.remove('armed');}
      else if(player.hasBomb){dom.bombIcon.textContent='◆ C4 CARRIED';dom.bombIcon.style.display='block';dom.bombIcon.classList.remove('armed');}
      else{dom.bombIcon.style.display='none';dom.bombIcon.classList.remove('armed');}
      const spd=hspd(player.vel);
      const ms=player.scoped?0:clamp(1+spd*0.12+player.recoilIdx*0.05+(player.onGround?0:0.45),1,2.4);
      dom.crosshair.style.transform=`translate(-50%,-50%) scale(${ms})`;
      dom.crosshair.style.opacity=player.scoped?'0':'1';
      // Scope overlay
      if(dom.scope) dom.scope.style.display=player.scoped?'block':'none';
      // Spectator bar
      if(dom.specBar){
        if(!player.alive&&state.started&&!state.matchOver){
          const friendlyBots=bots.filter(b=>b.alive&&b.team===player.team);
          if(friendlyBots.length>0){
            const spec=friendlyBots[state.specIdx%friendlyBots.length];
            dom.specBar.style.display='block';
            dom.specBar.textContent=`SPECTATING: ${spec.name} · ← → to cycle`;
          } else dom.specBar.style.display='none';
        } else dom.specBar.style.display='none';
      }
      // Round history dots
      if(dom.roundHist){
        dom.roundHist.replaceChildren();
        for(const rh of state.roundHistory.slice(-10)){
          const dot=document.createElement('div');
          dot.style.cssText=`width:8px;height:8px;border-radius:50%;background:${rh.winner==='CT'?'#87b9ff':'#f0a366'};opacity:0.85;`;
          dom.roundHist.appendChild(dot);
        }
      }
      if(dom.scoreboard){
        dom.scoreboard.style.display=state.scoreboardOpen?'block':'none';
        if(state.scoreboardOpen) renderScoreboard();
      }
    }

    function updateRound(dt:number){
      if(!state.started||state.matchOver)return;
      
      if (state.phase === 'live' || state.phase === 'planted') {
         const tAliveCount = (player.alive && player.team === 'T' ? 1 : 0) + 
                             bots.filter(b => b.alive && b.team === 'T').length + 
                             Array.from(remotePlayers.values()).filter(r => r.hp > 0 && r.team === 'T').length;
                             
         const ctAliveCount = (player.alive && player.team === 'CT' ? 1 : 0) + 
                              bots.filter(b => b.alive && b.team === 'CT').length + 
                              Array.from(remotePlayers.values()).filter(r => r.hp > 0 && r.team === 'CT').length;

         if (state.phase !== 'planted') { 
             if (tAliveCount === 0 && ctAliveCount === 0) endRound('CT', 'Draw');
             else if (tAliveCount === 0) endRound('CT', 'Terrorists eliminated');
             else if (ctAliveCount === 0) endRound('T', 'Counter-Terrorists eliminated');
         } else if (ctAliveCount === 0) {
             endRound('T', 'Counter-Terrorists eliminated');
         }
      }

      if(state.phase==='freeze'){state.phaseT-=dt;if(state.phaseT<=0){state.phase='live';state.phaseT=115;setBuyOpen(false);playRoundStart();}}
      else if(state.phase==='live'){state.phaseT-=dt;if(state.phaseT<=0)endRound('CT','Time expired');}
      else if(state.phase==='planted'){
        if(state.bomb){state.bomb.timer-=dt;
          updateBombBeep(state.bomb.timer);
          if(state.bomb.timer<=0){
            stopBombBeep(); playBombExplode();
            const fl=new THREE.PointLight(0xff8844,6,35);fl.position.copy(state.bomb.pos);scene.add(fl);scheduleTimeout(()=>scene.remove(fl),300);
            // Explosion particles
            for(let i=0;i<20;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(0.15+Math.random()*0.2,6,6),new THREE.MeshBasicMaterial({color:0xff6622}));p.position.copy(state.bomb.pos);p.position.x+=rand(-3,3);p.position.y+=rand(0,4);p.position.z+=rand(-3,3);scene.add(p);scheduleTimeout(()=>{scene.remove(p);disposeObject3DResources(p);},800+Math.random()*400);}
            if(state.bomb.mesh){scene.remove(state.bomb.mesh);disposeObject3DResources(state.bomb.mesh);}state.bomb=null;endRound('T','Bomb detonated');
          }
        }
      }
      else if(state.phase==='end'){state.phaseT-=dt;if(state.phaseT<=0&&!state.matchOver){state.round++;startRound();}}
      const shown=state.phase==='end'?state.frozenRoundTime:(state.phase==='planted'&&state.bomb?state.bomb.timer:state.phaseT);
      const cl=Math.max(0,shown);
      dom.timer.textContent=`${Math.floor(cl/60)}:${String(Math.floor(cl%60)).padStart(2,'0')}`;
      dom.phase.textContent=state.phase==='freeze'?'BUY':state.phase==='planted'?'BOMB':state.phase==='end'?'END':'LIVE';
    }

    function updateViewModel(dt:number){
      const specTarget = !player.alive ? state.specTarget : null;
      const w=specTarget?WEAPONS[specTarget.weapon]:activeWeapon();
      const scoped=specTarget?false:player.scoped;
      const recoilIdx=specTarget?0:player.recoilIdx;
      const speed=specTarget?0:hspd(player.vel);
      const landBob=specTarget?0:player.landBob;
      const switchBob=specTarget?1:player.switchBob;
      const pitchRef=specTarget?camera.rotation.x:player.pitch;
      const yawRef=specTarget?camera.rotation.y:player.yaw;
      const targetFov=w.scoped?(scoped?(w.scopeFov ?? 28):75):75;
      camera.fov+=( targetFov-camera.fov)*Math.min(1,dt*9);camera.updateProjectionMatrix();
      const t=performance.now()/1000;
      const spd=Math.min(1,speed/5);
      const bx=Math.sin(t*6.2)*0.008*spd;
      const by=Math.abs(Math.sin(t*8.4))*0.007*spd+landBob*0.018;
      const tz=w.scoped&&scoped?-0.44:-0.60-Math.min(0.05,recoilIdx*0.006);

      // Viewmodel sway calculation from mouse movements
      mouseVelX *= Math.exp(-15 * dt);
      mouseVelY *= Math.exp(-15 * dt);
      const swayX = clamp(-mouseVelX * 0.0006, -0.06, 0.06);
      const swayY = clamp(mouseVelY * 0.0006, -0.06, 0.06);

      // Inspect animation progression
      if (player.inspecting) {
        player.inspectT = Math.min(2.5, player.inspectT + dt);
        if (player.inspectT >= 2.5) { player.inspecting = false; player.inspectT = 0; }
      } else {
        player.inspectT = Math.max(0, player.inspectT - dt * 3.5);
      }
      const inspectArc = Math.sin((player.inspectT / 2.5) * Math.PI);
      const inspectRotY = inspectArc * 0.72;
      const inspectRotZ = inspectArc * 0.35;
      const inspectPosX = inspectArc * -0.07;
      const inspectPosY = inspectArc * 0.04;

      viewModel.position.lerp(vec(0.19+bx+swayX+inspectPosX,-0.25-by-(1-switchBob)*0.08+swayY+inspectPosY,tz),0.18);
      viewModel.rotation.x=lerp(viewModel.rotation.x,(w.scoped&&scoped?-0.07:0)-pitchRef*0.028,0.12);
      viewModel.rotation.y=lerp(viewModel.rotation.y,Math.sin(t*1.2)*0.01*spd-yawRef*0.012 + inspectRotY,0.1);
      viewModel.rotation.z=lerp(viewModel.rotation.z,Math.sin(t*3.3)*0.012*spd + inspectRotZ,0.1);
      player.switchBob=clamp(player.switchBob+dt*7,0,1);
    }

    // ─── MINIMAP (CS2-STYLE PLAYER-CENTERED) ──────────────────────────────────
    const MM_SIZE = 220;
    const MM_ZOOM = 3.2; // pixels per world unit (zoomed in on player)

    function worldToMinimap(wx:number,wz:number){
      // Player-centered: player is always at center of minimap
      const cx = MM_SIZE/2 + (wx - player.pos.x) * MM_ZOOM;
      const cy = MM_SIZE/2 + (wz - player.pos.z) * MM_ZOOM;
      return { x:cx, y:cy };
    }

    function drawMinimap(){
      if(!dom.minimap) return;
      const ctx=dom.minimap.getContext('2d');if(!ctx)return;
      dom.minimap.width = MM_SIZE; dom.minimap.height = MM_SIZE;
      ctx.clearRect(0,0,MM_SIZE,MM_SIZE);

      // Background with slight gradient
      const bgGrad = ctx.createRadialGradient(MM_SIZE/2,MM_SIZE/2,0,MM_SIZE/2,MM_SIZE/2,MM_SIZE*0.7);
      bgGrad.addColorStop(0,'rgba(12,16,22,0.92)');
      bgGrad.addColorStop(1,'rgba(6,8,12,0.96)');
      ctx.fillStyle=bgGrad;ctx.fillRect(0,0,MM_SIZE,MM_SIZE);

      // Grid lines (subtle)
      ctx.strokeStyle='rgba(255,255,255,0.03)';ctx.lineWidth=0.5;
      const gridStep = 10 * MM_ZOOM;
      const offsetX = (MM_SIZE/2) % gridStep - ((player.pos.x * MM_ZOOM) % gridStep);
      const offsetY = (MM_SIZE/2) % gridStep - ((player.pos.z * MM_ZOOM) % gridStep);
      for(let gx = offsetX; gx < MM_SIZE; gx += gridStep){ ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,MM_SIZE);ctx.stroke(); }
      for(let gy = offsetY; gy < MM_SIZE; gy += gridStep){ ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(MM_SIZE,gy);ctx.stroke(); }

      // Map walls
      ctx.fillStyle='rgba(100,92,76,0.72)';
      for(const w of minimapWalls){
        const p=worldToMinimap(w.x-w.w/2,w.z-w.d/2);
        const pw=w.w*MM_ZOOM, pd=w.d*MM_ZOOM;
        // Cull offscreen walls
        if(p.x+pw<0||p.x>MM_SIZE||p.y+pd<0||p.y>MM_SIZE) continue;
        ctx.fillRect(p.x,p.y,pw,pd);
      }
      // Wall outlines for depth
      ctx.strokeStyle='rgba(140,130,110,0.25)';ctx.lineWidth=0.5;
      for(const w of minimapWalls){
        const p=worldToMinimap(w.x-w.w/2,w.z-w.d/2);
        const pw=w.w*MM_ZOOM, pd=w.d*MM_ZOOM;
        if(p.x+pw<0||p.x>MM_SIZE||p.y+pd<0||p.y>MM_SIZE) continue;
        ctx.strokeRect(p.x,p.y,pw,pd);
      }

      // Site markers
      for(const [sx,sz,lbl] of [[A_SITE.x,A_SITE.z,'A'],[B_SITE.x,B_SITE.z,'B']] as any[]){
        const p=worldToMinimap(sx,sz);
        if(p.x<-30||p.x>MM_SIZE+30||p.y<-30||p.y>MM_SIZE+30) continue;
        // Site zone glow
        const sGrad=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,18);
        sGrad.addColorStop(0,'rgba(220,100,80,0.12)');
        sGrad.addColorStop(1,'rgba(220,100,80,0)');
        ctx.fillStyle=sGrad;ctx.fillRect(p.x-20,p.y-20,40,40);
        // Site border
        ctx.strokeStyle='rgba(220,100,80,0.5)';ctx.lineWidth=1.5;
        ctx.strokeRect(p.x-12,p.y-12,24,24);
        // Label
        ctx.fillStyle='rgba(220,100,80,0.85)';ctx.font='bold 11px Inter,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lbl,p.x,p.y);
      }

      // Dropped weapons
      for(const d of droppedWeapons){
        const p=worldToMinimap(d.group.position.x,d.group.position.z);
        if(p.x<-5||p.x>MM_SIZE+5||p.y<-5||p.y>MM_SIZE+5) continue;
        ctx.fillStyle='rgba(200,180,60,0.65)';
        ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();
      }

      // Bomb (dropped or planted)
      if(droppedBomb){
        const p=worldToMinimap(droppedBomb.pos.x,droppedBomb.pos.z);
        ctx.fillStyle=`rgba(255,120,40,${0.6+Math.sin(performance.now()*0.006)*0.4})`;
        ctx.beginPath();ctx.arc(p.x,p.y,4.5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(255,200,100,0.4)';ctx.lineWidth=1;ctx.stroke();
      }
      if(state.bomb){
        const p=worldToMinimap(state.bomb.pos.x,state.bomb.pos.z);
        const pulse=Math.sin(performance.now()*0.012*(1+Math.max(0,40-state.bomb.timer)/8));
        const flash=pulse>0;
        // Bomb glow ring
        ctx.strokeStyle=flash?'rgba(255,60,60,0.5)':'rgba(255,180,60,0.3)';
        ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,8+pulse*2,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle=flash?'rgba(255,60,60,1)':'rgba(255,180,60,0.9)';
        ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1;ctx.stroke();
      }

      // Bots (only show same-team bots, enemy bots shown only when engaged)
      for(const bot of bots){
        if(!bot.alive)continue;
        const p=worldToMinimap(bot.obj.position.x,bot.obj.position.z);
        if(p.x<-10||p.x>MM_SIZE+10||p.y<-10||p.y>MM_SIZE+10) continue;
        const isFriendly = bot.team === player.team;
        // Show friendly always, enemy only if recently seen or engaged
        if(!isFriendly && bot.aiState !== 'engage' && bot.lastSeenT > 2) continue;
        const dotColor = bot.team==='CT'?'rgba(80,160,255,0.92)':'rgba(255,120,60,0.92)';
        const dirColor = bot.team==='CT'?'rgba(120,190,255,0.7)':'rgba(255,160,90,0.7)';
        ctx.fillStyle=dotColor;
        ctx.beginPath();ctx.arc(p.x,p.y,isFriendly?4:3.5,0,Math.PI*2);ctx.fill();
        // Direction tick
        const yaw=bot.obj.rotation.y;
        ctx.strokeStyle=dirColor;ctx.lineWidth=1.4;
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.sin(yaw)*7,p.y+Math.cos(yaw)*7);ctx.stroke();
        // Name label for friendlies
        if(isFriendly){
          ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='7px Inter,Arial';ctx.textAlign='center';ctx.textBaseline='top';
          ctx.fillText(bot.name,p.x,p.y+6);
        }
        // Engagement indicator
        if(bot.aiState==='engage'){ctx.fillStyle='rgba(255,255,80,0.9)';ctx.beginPath();ctx.arc(p.x+4,p.y-4,2,0,Math.PI*2);ctx.fill();}
      }

      // Player (always at center)
      const pc = { x: MM_SIZE/2, y: MM_SIZE/2 };
      if(player.alive){
        // Direction cone / FOV indicator
        const cy=player.yaw;
        const fovGrad=ctx.createRadialGradient(pc.x,pc.y,0,pc.x,pc.y,28);
        fovGrad.addColorStop(0,'rgba(255,255,255,0.14)');
        fovGrad.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=fovGrad;
        ctx.beginPath();ctx.moveTo(pc.x,pc.y);
        ctx.arc(pc.x,pc.y,28,cy-0.48+Math.PI/2-Math.PI,cy+0.48+Math.PI/2-Math.PI);ctx.closePath();ctx.fill();
        // Player chevron (triangle pointing forward)
        ctx.save();
        ctx.translate(pc.x,pc.y);
        ctx.rotate(-cy);
        ctx.fillStyle='rgba(255,255,255,1)';
        ctx.beginPath();
        ctx.moveTo(0,-6);ctx.lineTo(-4.5,4);ctx.lineTo(0,2);ctx.lineTo(4.5,4);ctx.closePath();
        ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=0.8;ctx.stroke();
        ctx.restore();
      } else {
        // Dead X marker
        ctx.strokeStyle='rgba(255,80,80,0.8)';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(pc.x-5,pc.y-5);ctx.lineTo(pc.x+5,pc.y+5);ctx.stroke();
        ctx.beginPath();ctx.moveTo(pc.x+5,pc.y-5);ctx.lineTo(pc.x-5,pc.y+5);ctx.stroke();
      }

      // Compass directions at edges
      ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='bold 9px Inter,Arial';ctx.textAlign='center';ctx.textBaseline='middle';
      const compassR = MM_SIZE/2 - 8;
      const dirs = [{l:'N',a:Math.PI},{l:'S',a:0},{l:'W',a:Math.PI/2},{l:'E',a:-Math.PI/2}];
      for(const d of dirs){
        const a = d.a - player.yaw + Math.PI; // No rotation — just static compass
        // Static compass: just place at edges based on player yaw offset
        const nx = MM_SIZE/2 + Math.sin(d.a) * compassR;
        const ny = MM_SIZE/2 + Math.cos(d.a) * compassR;
        if(nx>4&&nx<MM_SIZE-4&&ny>4&&ny<MM_SIZE-4) ctx.fillText(d.l,nx,ny);
      }

      // Vignette border
      const vGrad = ctx.createRadialGradient(MM_SIZE/2,MM_SIZE/2,MM_SIZE*0.32,MM_SIZE/2,MM_SIZE/2,MM_SIZE*0.52);
      vGrad.addColorStop(0,'rgba(0,0,0,0)');
      vGrad.addColorStop(1,'rgba(0,0,0,0.35)');
      ctx.fillStyle=vGrad;ctx.fillRect(0,0,MM_SIZE,MM_SIZE);

      // Border
      ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;ctx.strokeRect(0.5,0.5,MM_SIZE-1,MM_SIZE-1);
    }

    const onResize=()=>{gameRenderer.resize(dom.game.clientWidth,dom.game.clientHeight,adaptiveQuality.pixelRatio);};
    addEventListener('resize',onResize);

    function syncAnimation(entity: any, speed: number, dt: number) {
      if (entity.mixer && entity.actions && entity.actions.idle && entity.actions.run) {
        const walkThreshold = 0.15;
        const runThreshold = 2.6;
        let play = 'idle';
        if (speed > runThreshold) {
          play = 'run';
        } else if (speed > walkThreshold) {
          play = 'walk';
        }

        if (entity.currentActionName === undefined) {
          entity.currentActionName = 'idle';
          entity.currentAction = entity.actions.idle;
        }
        
        if (entity.currentActionName !== play) {
          const current = entity.actions[play];
          const old = entity.actions[entity.currentActionName];
          
          if (current && old) {
            const fade = 0.5; // fadeDuration is 0.5 in the sample

            current.reset();
            current.weight = 1.0;
            current.stopFading();
            old.stopFading();

            // sync if not idle
            if (play !== 'idle') {
              const currentDuration = current.getClip().duration;
              const oldDuration = old.getClip().duration;
              if (currentDuration > 0 && oldDuration > 0) {
                current.time = old.time * (currentDuration / oldDuration);
              }
            }

            if (typeof (old as any)._scheduleFading === 'function' && typeof (current as any)._scheduleFading === 'function') {
              (old as any)._scheduleFading(fade, old.getEffectiveWeight(), 0);
              (current as any)._scheduleFading(fade, current.getEffectiveWeight(), 1);
            } else {
              old.fadeOut(fade);
              current.fadeIn(fade);
            }

            current.play();
            entity.currentActionName = play;
            entity.currentAction = current;
          }
        }
      }

      if (!entity.visualGroup) return;

      if (entity.procTime === undefined) {
        entity.procTime = Math.random() * 100;
      }
      entity.procTime += dt;

      const time = entity.procTime;
      const isMoving = speed > 0.15;

      if (!isMoving) {
        entity.visualGroup.position.y = Math.sin(time * 2.2) * 0.02;
        entity.visualGroup.rotation.z = Math.sin(time * 1.5) * 0.015;
        entity.visualGroup.rotation.x = Math.sin(time * 1.2) * 0.01;
        entity.visualGroup.position.x = 0;
        entity.visualGroup.position.z = 0;
      } else {
        const bobSpeed = Math.min(speed, 6.0) * 1.8;
        const bobAmp = 0.04 + Math.min(speed, 6.0) * 0.01;

        entity.visualGroup.position.y = Math.sin(time * bobSpeed * 2) * bobAmp - (bobAmp * 0.5);
        entity.visualGroup.position.x = Math.sin(time * bobSpeed) * bobAmp * 0.7;

        const targetLeanX = Math.min(speed, 6.0) * 0.03;
        entity.visualGroup.rotation.x = targetLeanX + Math.sin(time * bobSpeed * 2) * 0.02;
        entity.visualGroup.rotation.z = Math.sin(time * bobSpeed) * 0.04;
      }
    }

    let last=performance.now(),animId=0,lastBroadcast=0,lastPlayerBroadcast=0,tickCount=0;
    function tick(){
      tickCount++;
      (window as any).__SHARED_CHOKEPOINTS__ = new Map();
      try {
        const now=performance.now();const dt=Math.min(0.05,(now-last)/1000);last=now;
        if(adaptiveQuality.sampleFrame(dt)) renderer.setPixelRatio(adaptiveQuality.pixelRatio);
        if(state.started){
          updateSoundEvents(dt);
          // Multi: only host runs round logic. Singleplayer always updates.
          if (menuState === 'mode' || isHost || !isMultiplayerRef.current) {
            updateRound(dt);
          }
          updatePlayer(dt);
          if (player.mixer) player.mixer.update(dt);
          syncAnimation(player, hspd(player.vel), dt);

          for(const b of bots){
            const prevPos = b.obj.position.clone();
            updateBot(b,dt);
            if (b.mixer) b.mixer.update(dt);
            const movedDist = hspd(b.obj.position.clone().sub(prevPos));
            syncAnimation(b, movedDist / dt, dt);
          }
          updateDroppedWeapons(dt);
          updateHUD();
          
          if (isMultiplayerRef.current && now - lastPlayerBroadcast > 50) {
            lastPlayerBroadcast = now;
            roomManager.sendUpdate({
              type: 'PLAYER_UPDATE',
              player: {
                id: roomManager.getMyId(),
                name: playerNameRef.current,
                team: player.team,
                pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
                yaw: player.yaw,
                pitch: player.pitch,
                weapon: player.weapon,
                hp: player.hp,
                isShooting: player.shooting
              }
            });
            if (isHost) {
              for (const b of bots) {
                roomManager.sendUpdate({
                  type: 'PLAYER_UPDATE',
                  player: {
                    id: b.id,
                    name: b.name,
                    team: b.team,
                    pos: { x: b.obj.position.x, y: b.obj.position.y + 1.55, z: b.obj.position.z },
                    yaw: b.obj.rotation.y,
                    pitch: b.head.rotation.x,
                    weapon: b.weapon,
                    hp: b.hp,
                    isShooting: false
                  }
                });
              }
            }
          }

          if (isHost && now - lastBroadcast > 100) {
            lastBroadcast = now;
            // Broadcast state periodically
            roomManager.broadcastState({ 
              phase: state.phase, 
              timer: state.phaseT,
              score: { CT: state.ctScore, T: state.tScore },
              round: state.round,
              attackSite: state.attackSite
            });
          }
        }
        updateRemotePlayers(dt);
        updateViewModel(dt);drawMinimap();
        if (adaptiveQuality.sampleFrame(dt)) {
          gameRenderer.setPixelRatio(adaptiveQuality.pixelRatio);
        }
        gameRenderer.render(dt);animId=requestAnimationFrame(tick);
      } catch (err: any) {
        console.error("Game loop crashed:", err);
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(150,0,0,0.85);color:white;z-index:9999;padding:40px;font-family:monospace;white-space:pre-wrap;overflow:auto;';
        overlay.textContent = `FATAL GAME LOOP ERROR:\n\n${err?.message}\n\n${err?.stack}`;
        document.body.appendChild(overlay);
        document.exitPointerLock?.();
      }
    }
    tick();updateHUD();

    return()=>{
      cancelAnimationFrame(animId);
      for (const timeoutId of scheduledTimeouts) clearTimeout(timeoutId);
      scheduledTimeouts.clear();
      removeEventListener('keydown',onKD);removeEventListener('keyup',onKU);
      removeEventListener('mousedown',onMD);removeEventListener('mouseup',onMU);
      removeEventListener('pointerdown',onPD);removeEventListener('contextmenu',onCM);
      removeEventListener('mousemove',onMM);document.removeEventListener('pointerlockchange',onPLC);
      removeEventListener('resize',onResize);renderer.domElement.removeEventListener('click', onCanvasClick);audioSystem.stopBombBeep();audioSystem.stopAmbience();
      audioSystem.dispose();
      clearDroppedWeapons();
      clearBombWorld();
      clearBots();
      bloodGeo.dispose();
      bloodMat.dispose();
      impactGeo.dispose();
      impactMatDefault.dispose();
      impactMatBot.dispose();
      tracerPlayerMat.dispose();
      tracerPlayerScopedMat.dispose();
      tracerTMat.dispose();
      tracerCTMat.dispose();
      disposeObject3DResources(scene);
      gameRenderer.dispose();
    };
  },[]);

  if(webglError){
    return(
      <div style={{position:'fixed',inset:0,background:'#0c0f12',color:'#f3eee2',fontFamily:'"Trebuchet MS",Arial,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:20,padding:32,textAlign:'center'}}>
        <div style={{fontSize:48}}>⚠️</div>
        <h1 style={{fontSize:28,letterSpacing:'.16em',margin:0,color:'#f4d89a'}}>WEBGL REQUIRED</h1>
        <p style={{fontSize:15,opacity:.78,maxWidth:480,lineHeight:1.7,margin:0}}>
          This tactical FPS needs WebGL. Open it in a modern browser with hardware acceleration enabled.
        </p>
        <a href={window.location.href} target="_blank" rel="noreferrer" style={{marginTop:8,background:'linear-gradient(180deg,#f0d895,#d7ab53)',color:'#15120d',padding:'14px 36px',fontFamily:'inherit',fontSize:14,fontWeight:800,letterSpacing:'.28em',cursor:'pointer',borderRadius:999,textDecoration:'none'}}>
          OPEN IN BROWSER
        </a>
      </div>
    );
  }

  const isCT = chosenTeam === 'CT';

  function handleEnterMatch(isMulti = false) {
    if (!mapLoaded) {
      alert("Map still loading... please wait a few seconds.");
      return;
    }
    const name = username.trim() || 'Player';
    playerNameRef.current = name;
    isMultiplayerRef.current = isMulti;
    if (isMulti) {
      const roomState = roomManager.getState();
      const me = roomState.players.find(p => p.id === roomManager.getMyId());
      if (me) playerTeamRef.current = me.team as Team;
    } else {
      playerTeamRef.current = chosenTeam;
    }
    setLobbyOpen(false);
    setTimeout(() => enterMatchRef.current?.(), 60);
  }

  const onCreateRoom = () => {
    roomManager.createRoom(roomSettings, username || 'Player');
    setIsHost(true);
    isHostRef.current = true;
    setMenuState('lobby');
  };

  const onJoinRoom = () => {
    roomManager.joinRoom(roomCode, username || 'Player');
    setMenuState('lobby');
  };

  const onStartMultiplayerMatch = () => {
    roomManager.startMatch();
  };

  return (
    <div style={{position:'fixed',inset:0,background:'#0c0f12',color:'#f3eee2',fontFamily:'"Trebuchet MS","Arial Narrow",Arial,sans-serif',overflow:'hidden',userSelect:'none'}}>
      <div ref={containerRef} style={{position:'fixed',inset:0}} />

      {/* HUD */}
      <div ref={hudRef} style={{position:'fixed',inset:0,pointerEvents:'none',color:'#f3eee2',textShadow:'0 1px 2px #000',display:'none'}}>
        {/* Crosshair */}
        <div ref={crosshairRef} id="game-crosshair" style={{position:'absolute',left:'50%',top:'50%',width:28,height:28,transform:'translate(-50%,-50%)',filter:'drop-shadow(0 0 8px rgba(0,0,0,.4))'}} />
        <div ref={hitmarkRef} id="game-hitmark" style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:18,height:18,opacity:0,pointerEvents:'none'}} />
        <div ref={flashRef} style={{position:'absolute',inset:0,background:'#fff',opacity:0,pointerEvents:'none',transition:'opacity .2s'}} />
        <div ref={damageRef} style={{position:'absolute',inset:0,boxShadow:'inset 0 0 120px rgba(255,0,0,0)',pointerEvents:'none',transition:'box-shadow .3s'}} />
        <div ref={lowHpVignetteRef} className="low-hp-vignette" />

        {/* Killstreak Announcer Banner */}
        <div ref={killstreakRef} className="killstreak-banner">
          <div ref={killstreakTextRef} className="killstreak-text">DOUBLE KILL</div>
          <div ref={killstreakSubRef} className="killstreak-sub">ELIMINATED BOT</div>
        </div>

        {/* Round MVP Card */}
        <div ref={mvpCardRef} className="mvp-card-container">
          <div className="mvp-title">★ ROUND MVP ★</div>
          <div ref={mvpNameRef} className="mvp-name">PLAYER</div>
          <div ref={mvpReasonRef} className="mvp-reason">FOR 3 ELIMINATIONS</div>
        </div>

        {/* Weapon Inspect Hint */}
        <div className="inspect-hint">
          <span className="inspect-key">F</span> INSPECT WEAPON
        </div>

        {/* AWP Scope overlay */}
        <div ref={scopeRef} className="game-scope" style={{display:'none'}}>
          <div className="game-scope-lens">
            <div className="game-scope-line game-scope-line-v" />
            <div className="game-scope-line game-scope-line-h" />
            <div className="game-scope-dot" />
          </div>
        </div>

        {/* Spectator bar */}
        <div ref={specBarRef} style={{position:'absolute',bottom:'50%',left:'50%',transform:'translate(-50%,50%)',background:'linear-gradient(180deg,rgba(16,22,28,.94),rgba(8,12,18,.9))',padding:'10px 24px',border:'1px solid rgba(255,255,255,.12)',borderRadius:999,display:'none',fontSize:12,letterSpacing:'.18em',color:'#f4d89a',textAlign:'center',zIndex:5}} />

        {/* Top bar */}
        <div style={{position:'absolute',top:16,left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:6,fontSize:13,letterSpacing:'.14em'}}>
          <div style={{display:'flex',gap:10,alignItems:'stretch'}}>
          <div style={{minWidth:120,background:'linear-gradient(180deg,rgba(30,40,52,.96),rgba(14,18,24,.94))',border:'1px solid rgba(135,185,255,.18)',borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div><div style={{fontSize:9,opacity:.56,letterSpacing:'.2em'}}>COUNTER-TERRORIST</div><div ref={ctAliveRef} style={{fontSize:26,fontWeight:800,lineHeight:1,color:'#87b9ff'}}>5</div></div>
            <div style={{fontSize:9,opacity:.4}}>CT</div>
          </div>
          <div style={{minWidth:185,background:'linear-gradient(180deg,rgba(40,32,20,.95),rgba(18,19,24,.93))',border:'1px solid rgba(255,255,255,.08)',borderRadius:14,padding:'10px 18px',textAlign:'center'}}>
            <div ref={phaseRef} style={{fontSize:9,opacity:.62,marginBottom:4,letterSpacing:'.22em'}}>FREEZE</div>
            <div ref={timerRef} style={{fontSize:30,fontWeight:800,color:'#f4d89a',lineHeight:1}}>0:00</div>
            <div style={{display:'flex',justifyContent:'center',gap:14,marginTop:6}}>
              <span ref={ctScoreRef} style={{color:'#87b9ff',fontWeight:800,fontSize:16}}>0</span>
              <span style={{opacity:.35,fontSize:9,letterSpacing:'.2em',alignSelf:'center'}}>TO 8</span>
              <span ref={tScoreRef} style={{color:'#f0a366',fontWeight:800,fontSize:16}}>0</span>
            </div>
          </div>
          <div style={{minWidth:120,background:'linear-gradient(180deg,rgba(48,28,18,.96),rgba(18,14,10,.94))',border:'1px solid rgba(240,163,102,.18)',borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div><div style={{fontSize:9,opacity:.56,letterSpacing:'.2em'}}>TERRORISTS</div><div ref={tAliveRef} style={{fontSize:26,fontWeight:800,lineHeight:1,color:'#f0a366'}}>5</div></div>
            <div style={{fontSize:9,opacity:.4}}>T</div>
          </div>
          </div>
          {/* Round history dots */}
          <div ref={roundHistRef} style={{display:'flex',gap:4,padding:'3px 8px',background:'rgba(10,12,16,.7)',borderRadius:999}} />
        </div>

        {/* Minimap — top-left corner (CS2-style) */}
        <div style={{position:'absolute',top:14,left:14,borderRadius:12,overflow:'hidden',border:'1px solid rgba(255,255,255,.1)',boxShadow:'0 4px 28px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.3)',background:'rgba(6,8,12,0.95)'}}>
          <canvas ref={minimapRef} width={220} height={220} style={{display:'block',borderRadius:11}} />
          <div style={{position:'absolute',top:6,left:8,fontSize:8,letterSpacing:'.18em',color:'rgba(255,255,255,.35)',fontWeight:600,textTransform:'uppercase'}}>RADAR</div>
          <div style={{position:'absolute',top:5,right:8,fontSize:8,letterSpacing:'.12em',color:'rgba(255,255,255,.25)',fontWeight:500}}>{mapRadarName}</div>
        </div>

        {/* Killfeed */}
        <div ref={killfeedRef} style={{position:'absolute',top:14,right:16,display:'flex',flexDirection:'column',gap:5,fontSize:11,alignItems:'flex-end'}} />

        {/* Bomb / player tag strip — below minimap */}
        <div style={{position:'absolute',top:248,left:16,display:'flex',flexDirection:'column',gap:6}}>
          <div ref={bombIconRef} style={{background:'linear-gradient(180deg,rgba(46,34,22,.96),rgba(18,16,14,.9))',padding:'7px 13px',border:'1px solid rgba(232,195,106,.25)',borderRadius:999,fontSize:10,color:'#f4d89a',display:'none',letterSpacing:'.22em'}}>◆ BOMB</div>
          <div ref={playerTagRef} style={{background:'linear-gradient(180deg,rgba(18,24,32,.9),rgba(10,13,18,.84))',padding:'5px 12px',border:'1px solid rgba(255,255,255,.07)',borderRadius:999,fontSize:10,letterSpacing:'.2em',opacity:.82}}></div>
        </div>

        {/* Defuse bar */}
        <div ref={defuseRef} style={{position:'absolute',left:'50%',bottom:'30%',transform:'translateX(-50%)',background:'linear-gradient(180deg,rgba(18,30,44,.97),rgba(8,14,20,.93))',padding:'12px 20px',border:'1px solid rgba(135,185,255,.4)',borderRadius:14,display:'none',fontSize:12,color:'#87b9ff',letterSpacing:'.18em',textAlign:'center'}}>
          ⚙ DEFUSING…
          <div style={{marginTop:8,height:7,width:240,background:'rgba(255,255,255,.08)',borderRadius:999,overflow:'hidden'}}>
            <div ref={defuseBarRef} style={{height:'100%',background:'linear-gradient(90deg,#87b9ff,#a8d0ff)',width:'0%',transition:'width .1s linear'}} />
          </div>
        </div>

        {/* Plant bar (T-side player) */}
        <div ref={plantRef} style={{position:'absolute',left:'50%',bottom:'30%',transform:'translateX(-50%)',background:'linear-gradient(180deg,rgba(44,26,18,.97),rgba(20,12,8,.93))',padding:'12px 20px',border:'1px solid rgba(240,163,102,.4)',borderRadius:14,display:'none',fontSize:12,color:'#f0a366',letterSpacing:'.18em',textAlign:'center'}}>
          ◆ PLANTING…
          <div style={{marginTop:8,height:7,width:240,background:'rgba(255,255,255,.08)',borderRadius:999,overflow:'hidden'}}>
            <div ref={plantBarRef} style={{height:'100%',background:'linear-gradient(90deg,#f0a366,#ffcf8a)',width:'0%',transition:'width .1s linear'}} />
          </div>
        </div>

        {/* Action prompt */}
        <div ref={actionPromptRef} style={{position:'absolute',left:'50%',bottom:'22%',transform:'translateX(-50%)',background:'linear-gradient(180deg,rgba(16,22,28,.96),rgba(10,12,17,.9))',padding:'9px 18px',border:'1px solid rgba(255,255,255,.1)',borderRadius:999,display:'none',fontSize:11,letterSpacing:'.18em',color:'#f4d89a'}} />

        {/* Scoreboard */}
        <div ref={scoreboardRef} className="game-scoreboard" style={{display:'none'}} />

        {/* Bottom HUD */}
        <div style={{position:'absolute',bottom:18,left:16,right:16,display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:16}}>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            <div style={{background:'linear-gradient(180deg,rgba(20,26,32,.9),rgba(11,14,18,.84))',border:'1px solid rgba(255,255,255,.07)',padding:'11px 15px',borderRadius:14,fontSize:12,letterSpacing:'.08em'}}>
              <span style={{display:'block',fontSize:9,letterSpacing:'.22em',opacity:.56,marginBottom:5}}>SURVIVAL</span>
              <div style={{display:'flex',alignItems:'baseline',gap:9}}>
                <span ref={hpRef} style={{color:'#92d7a3',fontSize:30,fontWeight:800,lineHeight:1}}>100</span>
                <span style={{fontSize:11,opacity:.6}}>HP</span>
                <span ref={armorRef} style={{color:'#a9c9ff',fontSize:12}}>· 0 ARMOR</span>
              </div>
            </div>
            <div style={{background:'linear-gradient(180deg,rgba(20,26,32,.9),rgba(11,14,18,.84))',border:'1px solid rgba(255,255,255,.07)',padding:'11px 15px',borderRadius:14,fontSize:12}}>
              <span style={{display:'block',fontSize:9,letterSpacing:'.22em',opacity:.56,marginBottom:5}}>ECONOMY</span>
              $<span ref={moneyRef} style={{color:'#f4d89a',fontSize:24,fontWeight:800}}>800</span>
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:7,alignItems:'flex-end'}}>
            <div ref={weaponNameRef} style={{textAlign:'right',fontSize:10,opacity:.72,letterSpacing:'.28em',marginBottom:4}}>KNIFE</div>
            <div ref={ammoRef} style={{background:'linear-gradient(180deg,rgba(20,26,32,.9),rgba(11,14,18,.84))',border:'1px solid rgba(255,255,255,.07)',padding:'11px 15px',borderRadius:14,fontSize:32,fontWeight:800,textAlign:'right',lineHeight:1}}>
              <span ref={ammoPrimaryRef}>—</span>{' '}
              <small ref={ammoReserveRef} style={{fontSize:15,opacity:.55,fontWeight:600,display:'none'}} />
            </div>
          </div>
        </div>

        {/* Buy menu */}
        <div ref={buyRef} style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',background:'linear-gradient(180deg,rgba(16,21,28,.97),rgba(9,11,15,.95))',border:'1px solid rgba(255,255,255,.09)',borderRadius:24,padding:26,width:'min(660px,calc(100vw - 28px))',maxHeight:'min(78vh,760px)',overflow:'auto',display:'none',pointerEvents:'auto'}}>
          <h2 style={{margin:'0 0 3px 0',letterSpacing:'.28em',color:'#f4d89a',fontSize:14}}>BUY MENU</h2>
          <div style={{fontSize:10,opacity:.62,letterSpacing:'.18em',marginBottom:18}}>FREEZE TIME — PRESS B TO CLOSE</div>
          <div ref={buyGridRef} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}} />
          <div style={{marginTop:14,fontSize:10,opacity:.52,textAlign:'center',letterSpacing:'.18em'}}>[ 1-9 ] buy · [ B ] close · [ R ] reload · [ G ] drop · [ E ] interact</div>
        </div>

        {/* Round end */}
        <div ref={roundEndRef} style={{position:'absolute',left:'50%',top:'26%',transform:'translate(-50%,-50%)',background:'linear-gradient(180deg,rgba(16,22,30,.97),rgba(10,12,16,.95))',padding:'26px 50px',border:'1px solid rgba(255,255,255,.09)',borderRadius:22,textAlign:'center',display:'none',fontSize:26,letterSpacing:'.24em'}}>
          <div ref={roundWinnerRef}>CT WIN</div>
          <div ref={roundReasonRef} style={{fontSize:11,opacity:.68,marginTop:7,letterSpacing:'.18em'}} />
        </div>
      </div>

      {/* ── LOBBY SCREEN ─────────────────────────────────────────────────────── */}
      {lobbyOpen && (
        <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,
          background:'radial-gradient(ellipse at 50% 0%,rgba(30,50,80,.55) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(80,30,10,.4) 0%,transparent 55%),linear-gradient(160deg,#08090d 0%,#0c0e14 50%,#0a0d11 100%)',
          backgroundSize:'100% 100%',zIndex:100,pointerEvents:'auto'}}>

          {/* Decorative grid lines */}
          <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)',backgroundSize:'48px 48px',pointerEvents:'none'}} />

          {/* Main card */}
          <div className="game-lobby-card" style={{position:'relative',maxWidth:860,width:'100%',background:'linear-gradient(160deg,rgba(18,23,32,.92),rgba(12,14,20,.96))',border:'1px solid rgba(255,255,255,.09)',borderRadius:28,padding:'40px 44px 36px',boxShadow:'0 40px 100px rgba(0,0,0,.6)',backdropFilter:'blur(18px)'}}>

            {/* Logo */}
            <div style={{textAlign:'center',marginBottom:32}}>
              <div style={{fontSize:11,letterSpacing:'.55em',color:'rgba(255,255,255,.38)',marginBottom:8,textTransform:'uppercase'}}>{mapTagline}</div>
              <h1 style={{margin:0,fontSize:'clamp(44px,7vw,78px)',fontWeight:900,letterSpacing:'.1em',lineHeight:.95,
                background:'linear-gradient(135deg,#f5e8c8 10%,#d9ab5a 50%,#f5e8c8 90%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',textTransform:'uppercase'}}>
                {mapName}
              </h1>
            </div>

            {!mapLoaded && (
              <div style={{marginTop: 32, textAlign: 'center'}}>
                <div style={{fontSize: 10, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.4)', marginBottom: 16, textTransform: 'uppercase'}}>
                  {loadingStatus}
                </div>
                <div style={{width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)'}}>
                  <div style={{width: `${loadingProgress}%`, height: '100%', background: 'linear-gradient(90deg, #d9ab5a, #f5e8c8)', transition: 'width 0.4s cubic-bezier(0.1, 0, 0.2, 1)'}} />
                </div>
                <div style={{marginTop: 12, fontSize: 11, fontWeight: 800, color: '#f5e8c8', letterSpacing: '0.1em'}}>{loadingProgress}%</div>
              </div>
            )}

            {mapLoaded && (
              <>
                {menuState === 'mode' && (
                  <div style={{textAlign:'center'}}>
                    <div style={{marginBottom:32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
                      <button className="game-buybtn" style={{padding: '30px', fontSize: 18, justifyContent: 'center'}} onClick={() => setMenuState('single-setup')}>
                        SINGLEPLAYER
                      </button>
                      <button className="game-buybtn" style={{padding: '30px', fontSize: 18, justifyContent: 'center'}} onClick={() => setMenuState('multi-home')}>
                        MULTIPLAYER
                      </button>
                    </div>
                    <div style={{fontSize:10,letterSpacing:'.38em',color:'rgba(255,255,255,.34)'}}>CHOOSE YOUR EXPERIENCE</div>
                  </div>
                )}

                {menuState === 'single-setup' && (
                  <div style={{textAlign:'center'}}>
                    <div style={{marginBottom:20}}>
                       <input
                        type="text"
                        maxLength={20}
                        placeholder="Player Name..."
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        onKeyDown={e => { if(e.key==='Enter') handleEnterMatch(false); }}
                        style={{width:'100%', maxWidth: 300, boxSizing:'border-box',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,color:'#f3eee2',fontFamily:'inherit',fontSize:14,fontWeight:600,letterSpacing:'.08em',padding:'13px 16px',outline:'none',textAlign:'center', marginBottom: 20}}
                      />
                    </div>

                    <div style={{marginBottom: 20}}>
                       <div style={{fontSize: 9, opacity: 0.5, letterSpacing: '0.2em', marginBottom: 10}}>SIDE PREFERENCE</div>
                       <div style={{display: 'flex', justifyContent: 'center', gap: 10}}>
                          <button className="game-buybtn" style={{width: 120, fontSize: 10, justifyContent: 'center', background: chosenTeam === 'CT' ? 'rgba(135,185,255,0.2)' : 'transparent', borderColor: chosenTeam === 'CT' ? '#87b9ff' : 'rgba(255,255,255,0.1)'}} onClick={() => setChosenTeam('CT')}>CT</button>
                          <button className="game-buybtn" style={{width: 120, fontSize: 10, justifyContent: 'center', background: chosenTeam === 'T' ? 'rgba(240,163,102,0.2)' : 'transparent', borderColor: chosenTeam === 'T' ? '#f0a366' : 'rgba(255,255,255,0.1)'}} onClick={() => setChosenTeam('T')}>T</button>
                       </div>
                    </div>
                    <button className="game-buybtn" style={{padding: '15px', justifyContent: 'center', maxWidth: 300, margin: '0 auto'}} onClick={() => handleEnterMatch(false)}>
                      START MATCH
                    </button>
                    <div style={{marginTop: 20}}>
                      <button style={{background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:11, letterSpacing: '0.2em'}} onClick={() => setMenuState('mode')}>BACK</button>
                    </div>
                  </div>
                )}

                {menuState === 'multi-home' && (
                  <div style={{textAlign:'center'}}>
                    <div style={{marginBottom:20}}>
                       <input
                        type="text"
                        maxLength={20}
                        placeholder="Player Name..."
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        style={{width:'100%', maxWidth: 300, boxSizing:'border-box',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,color:'#f3eee2',fontFamily:'inherit',fontSize:14,fontWeight:600,letterSpacing:'.08em',padding:'13px 16px',outline:'none',textAlign:'center', marginBottom: 20}}
                      />
                    </div>
                    <div style={{marginBottom:32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
                      <button className="game-buybtn" style={{padding: '20px', justifyContent: 'center'}} onClick={() => setMenuState('create')}>
                        CREATE ROOM
                      </button>
                      <button className="game-buybtn" style={{padding: '20px', justifyContent: 'center'}} onClick={() => setMenuState('join')}>
                        JOIN ROOM
                      </button>
                    </div>
                    <button style={{background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:11, letterSpacing: '0.2em'}} onClick={() => setMenuState('mode')}>BACK</button>
                  </div>
                )}

                {menuState === 'create' && (
                  <div style={{textAlign:'center'}}>
                    <h3 style={{letterSpacing: '0.2em', marginBottom: 20}}>ROOM SETTINGS</h3>
                    <div style={{marginBottom:28, display: 'flex', justifyContent: 'center', gap: 20}}>
                      <div>
                        <label style={{display:'block', fontSize: 9, opacity: 0.5, marginBottom: 5}}>TEAM SIZE</label>
                        <select value={roomSettings.teamSize} onChange={e => setRoomSettings({...roomSettings, teamSize: parseInt(e.target.value)})} style={{background: '#1a1e24', color: '#fff', border: '1px solid #333', padding: '10px', borderRadius: 8}}>
                          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}v{n}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{display:'block', fontSize: 9, opacity: 0.5, marginBottom: 5}}>MAX ROUNDS</label>
                        <select value={roomSettings.maxRounds} onChange={e => setRoomSettings({...roomSettings, maxRounds: parseInt(e.target.value)})} style={{background: '#1a1e24', color: '#fff', border: '1px solid #333', padding: '10px', borderRadius: 8}}>
                          {[5,10,15,30].map(n => <option key={n} value={n}>{n} Rounds</option>)}
                        </select>
                      </div>

                    </div>
                    <button className="game-buybtn" style={{padding: '15px', justifyContent: 'center', maxWidth: 300, margin: '0 auto'}} onClick={onCreateRoom}>
                      CREATE
                    </button>
                    <div style={{marginTop: 20}}>
                      <button style={{background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:11, letterSpacing: '0.2em'}} onClick={() => setMenuState('multi-home')}>BACK</button>
                    </div>
                  </div>
                )}

                {menuState === 'join' && (
                  <div style={{textAlign:'center'}}>
                    <h3 style={{letterSpacing: '0.2em', marginBottom: 20}}>ENTER ROOM CODE</h3>
                    <input
                      type="text"
                      placeholder="Code..."
                      value={roomCode}
                      onChange={e => setRoomCode(e.target.value)}
                      style={{width:'100%', maxWidth: 300, boxSizing:'border-box',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,color:'#f3eee2',fontFamily:'inherit',fontSize:14,fontWeight:600,letterSpacing:'.08em',padding:'13px 16px',outline:'none',textAlign:'center', marginBottom: 20}}
                    />
                    <button className="game-buybtn" style={{padding: '15px', justifyContent: 'center', maxWidth: 300, margin: '0 auto'}} onClick={onJoinRoom}>
                      JOIN
                    </button>
                    <div style={{marginTop: 20}}>
                      <button style={{background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:11, letterSpacing: '0.2em'}} onClick={() => setMenuState('multi-home')}>BACK</button>
                    </div>
                  </div>
                )}

                {menuState === 'lobby' && (
                  <div style={{textAlign:'center'}}>
                    <div style={{background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: 16, marginBottom: 20}}>
                      <div style={{fontSize: 10, opacity: 0.5, letterSpacing: '0.2em'}}>ROOM CODE</div>
                      <div style={{fontSize: 24, fontWeight: 800, color: '#f4d89a'}}>{roomCode || 'Connecting...'}</div>
                    </div>

                    <div style={{marginBottom: 24}}>
                      <div style={{fontSize: 9, opacity: 0.5, letterSpacing: '0.2em', marginBottom: 10}}>SWITCH TEAM</div>
                      <div style={{display: 'flex', justifyContent: 'center', gap: 10}}>
                        <button className="game-buybtn" style={{width: 100, fontSize: 10, justifyContent: 'center', background: 'rgba(135,185,255,0.1)', borderColor: 'rgba(135,185,255,0.3)'}} onClick={() => roomManager.requestTeam('CT')}>CT</button>
                        <button className="game-buybtn" style={{width: 100, fontSize: 10, justifyContent: 'center', background: 'rgba(240,163,102,0.1)', borderColor: 'rgba(240,163,102,0.3)'}} onClick={() => roomManager.requestTeam('T')}>T</button>
                        <button className="game-buybtn" style={{width: 100, fontSize: 10, justifyContent: 'center'}} onClick={() => roomManager.requestTeam('Spectator')}>SPEC</button>
                      </div>
                    </div>
                    
                    <div style={{textAlign: 'left', marginBottom: 20}}>
                       <div style={{fontSize: 9, opacity: 0.5, letterSpacing: '0.2em', marginBottom: 10}}>PLAYERS ({networkPlayers.length})</div>
                       <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                          {networkPlayers.map(p => (
                            <div key={p.id} style={{background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', border: p.id === roomManager.getMyId() ? '1px solid #f4d89a' : '1px solid transparent'}}>
                              <span>{p.name} {p.isHost ? '👑' : ''}</span>
                              <span style={{fontSize: 10, opacity: 0.6, color: p.team === 'CT' ? '#87b9ff' : p.team === 'T' ? '#f0a366' : '#fff'}}>{p.team.toUpperCase()}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    {isHost ? (
                      <button className="game-buybtn" style={{padding: '15px', justifyContent: 'center', maxWidth: 300, margin: '0 auto', background: 'linear-gradient(180deg,#92d7a3,#4caf50)', color: '#000'}} onClick={onStartMultiplayerMatch}>
                        START MATCH
                      </button>
                    ) : (
                      <div style={{fontSize: 12, letterSpacing: '0.1em', opacity: 0.8}}>Waiting for host to start...</div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      )}

      <style>{`
        #game-crosshair::before,#game-crosshair::after{content:"";position:absolute;background:#d8f0c0}
        #game-crosshair::before{left:50%;top:2px;width:2px;height:8px;transform:translateX(-50%);box-shadow:0 16px 0 #d8f0c0,0 0 4px rgba(0,0,0,.7),0 16px 4px rgba(0,0,0,.7)}
        #game-crosshair::after{top:50%;left:2px;height:2px;width:8px;transform:translateY(-50%);box-shadow:16px 0 0 #d8f0c0,0 0 4px rgba(0,0,0,.7),16px 0 4px rgba(0,0,0,.7)}
        #game-crosshair.game-crosshair-hit::before{background:#ff4444;box-shadow:0 16px 0 #ff4444,0 0 4px rgba(0,0,0,.7),0 16px 4px rgba(0,0,0,.7)}
        #game-crosshair.game-crosshair-hit::after{background:#ff4444;box-shadow:16px 0 0 #ff4444,0 0 4px rgba(0,0,0,.7),16px 0 4px rgba(0,0,0,.7)}
        #game-hitmark::before,#game-hitmark::after{content:"";position:absolute;background:#fff;width:10px;height:2px;top:50%;left:50%}
        #game-hitmark::before{transform:translate(-50%,-50%) rotate(45deg)}
        #game-hitmark::after{transform:translate(-50%,-50%) rotate(-45deg)}
        #game-hitmark.game-hitmark-head::before,#game-hitmark.game-hitmark-head::after{background:#ffdf75;width:16px;box-shadow:0 0 12px rgba(255,210,90,.8)}
        .game-scope{position:absolute;inset:0;pointer-events:none;z-index:10;background:rgba(0,0,0,.04)}
        .game-scope-lens{position:absolute;left:50%;top:50%;width:min(78vmin,860px);height:min(78vmin,860px);transform:translate(-50%,-50%);border-radius:50%;box-shadow:0 0 0 9999px rgba(0,0,0,.96),inset 0 0 0 2px rgba(8,8,8,.95),inset 0 0 42px rgba(0,0,0,.5);background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.03) 0,rgba(255,255,255,.012) 46%,rgba(0,0,0,.1) 72%,rgba(0,0,0,.55) 100%)}
        .game-scope-line{position:absolute;background:rgba(0,0,0,.86);box-shadow:0 0 1px rgba(255,255,255,.35)}
        .game-scope-line-v{left:50%;top:0;bottom:0;width:1px;transform:translateX(-50%)}
        .game-scope-line-h{top:50%;left:0;right:0;height:1px;transform:translateY(-50%)}
        .game-scope-dot{position:absolute;left:50%;top:50%;width:4px;height:4px;border-radius:50%;background:rgba(0,0,0,.92);transform:translate(-50%,-50%);box-shadow:0 0 0 1px rgba(255,255,255,.18)}
        .game-buybtn{background:linear-gradient(180deg,rgba(28,36,46,.92),rgba(17,20,26,.9));border:1px solid rgba(255,255,255,.08);color:#f3eee2;padding:13px 14px;border-radius:14px;cursor:pointer;font-family:inherit;text-align:left;display:flex;justify-content:space-between;align-items:center;font-size:12px;transition:transform .14s,border-color .14s;width:100%}
        .game-buybtn:hover{border-color:rgba(232,195,106,.5);background:linear-gradient(180deg,rgba(36,46,56,.98),rgba(22,27,34,.96));transform:translateY(-1px)}
        .game-buybtn:disabled{opacity:.35;cursor:not-allowed}
        .game-price{color:#f4d89a;font-weight:800;font-size:13px}
        .game-key{font-size:10px;opacity:.46;margin-right:6px;color:#aaa}
        .game-kf{background:linear-gradient(180deg,rgba(14,19,26,.94),rgba(10,13,18,.88));padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.07);backdrop-filter:blur(6px)}
        .game-kf-a{font-weight:700}
        .game-kf-b{opacity:.55;margin:0 6px;font-size:10px}
        .game-scoreboard{position:absolute;left:50%;top:50%;width:min(860px,calc(100vw - 32px));transform:translate(-50%,-50%);background:linear-gradient(180deg,rgba(12,16,22,.96),rgba(7,9,12,.94));border:1px solid rgba(255,255,255,.12);box-shadow:0 28px 90px rgba(0,0,0,.62);padding:16px;border-radius:8px;z-index:9}
        .game-score-title{display:flex;justify-content:space-between;align-items:center;color:#f4d89a;font-size:12px;font-weight:800;letter-spacing:.26em;margin:0 0 12px}
        .game-score-title span{font-size:10px;color:rgba(255,255,255,.45);letter-spacing:.18em}
        .game-score-team{border:1px solid color-mix(in srgb,var(--team) 26%,transparent);background:rgba(255,255,255,.035);border-radius:6px;overflow:hidden;margin-top:8px}
        .game-score-team header{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,color-mix(in srgb,var(--team) 22%,rgba(20,22,28,.94)),rgba(12,14,18,.84));padding:8px 10px;color:var(--team);letter-spacing:.18em;font-size:11px}
        .game-score-team header b{font-size:20px;color:#f3eee2;letter-spacing:0}
        .game-score-head,.game-score-row{display:grid;grid-template-columns:1.8fr .32fr .32fr .52fr 1fr .52fr;gap:8px;align-items:center;padding:7px 10px;font-size:11px}
        .game-score-head{color:rgba(255,255,255,.42);letter-spacing:.16em;font-size:9px;border-bottom:1px solid rgba(255,255,255,.06)}
        .game-score-row{color:rgba(255,255,255,.82);border-bottom:1px solid rgba(255,255,255,.035)}
        .game-score-row.dead{opacity:.42}
        .game-score-row span:not(.game-score-name){text-align:right}
        .game-score-name{font-weight:800;color:#f3eee2;letter-spacing:.08em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .armed{color:#ff5552!important;animation:gm-pulse .55s infinite}
        select:focus{outline:none;border-color:#f4d89a!important}
        option{background:#1a1e24;color:#fff}
        @keyframes gm-pulse{50%{opacity:.38}}
        input::placeholder{color:rgba(255,255,255,.28)}
        input:focus{border-color:rgba(255,255,255,.28)!important;box-shadow:0 0 0 3px rgba(255,255,255,.06)}
        @media (max-width:720px){
          .game-lobby-card{max-width:430px!important;max-height:calc(100vh - 24px)!important;overflow:auto!important;border-radius:12px!important;padding:22px 16px 20px!important}
          .game-team-grid{grid-template-columns:1fr!important;gap:10px!important}
          .game-team-card{border-radius:10px!important;padding:14px!important}
          .game-team-card div{overflow-wrap:anywhere}
          .game-scoreboard{top:52%!important;width:calc(100vw - 18px)!important;padding:10px!important}
          .game-score-head,.game-score-row{grid-template-columns:1.5fr .28fr .28fr .45fr .9fr!important;gap:5px!important;font-size:9px!important;padding:6px!important}
          .game-score-head span:last-child,.game-score-row span:last-child{display:none}
          .game-score-title{font-size:10px!important;letter-spacing:.16em!important}
        }
      `}</style>
    </div>
  );
}

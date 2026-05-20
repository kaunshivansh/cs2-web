import Peer, { DataConnection } from 'peerjs';
import type { Team as MatchTeam } from '../gameplay/match/MatchRules';

export type Team = MatchTeam | 'Spectator';

export interface NetworkPlayer {
  id: string;
  name: string;
  team: Team;
  isHost: boolean;
  pos: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  weapon: string;
  hp: number;
  isShooting: boolean;
}

export interface RoomSettings {
  teamSize: number;
  maxRounds: number;
  map: string;
}

export interface RoomState {
  code: string;
  settings: RoomSettings;
  players: NetworkPlayer[];
  phase: string;
  timer: number;
  started: boolean;
}

export type NetworkEvent = 
  | { type: 'ROOM_UPDATE'; state: RoomState }
  | { type: 'PLAYER_UPDATE'; player: NetworkPlayer }
  | { type: 'ACTION'; id: string, action: 'shoot' | 'jump' | 'reload' };

export class RoomManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private isHost: boolean = false;
  private onStateChange: (state: RoomState) => void = () => {};
  private onEvent: (event: NetworkEvent) => void = () => {};

  private state: RoomState = {
    code: '',
    settings: { teamSize: 5, maxRounds: 15, map: 'HARBOR' },
    players: [],
    phase: 'LOBBY',
    timer: 0,
    started: false
  };

  constructor() {}

  public init(callback: (id: string) => void) {
    this.peer = new Peer();
    this.peer.on('open', (id) => {
      callback(id);
    });

    this.peer.on('connection', (conn) => {
      this.handleIncomingConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS error:', err);
    });
  }

  public createRoom(settings: RoomSettings, playerName: string) {
    this.isHost = true;
    this.state.settings = settings;
    this.state.players = [{
      id: this.peer!.id,
      name: playerName,
      team: 'CT',
      isHost: true,
      pos: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      weapon: 'knife',
      hp: 100,
      isShooting: false
    }];
    this.state.code = this.peer!.id;
    this.onStateChange(this.state);
  }

  public joinRoom(code: string, playerName: string) {
    this.isHost = false;
    const conn = this.peer!.connect(code);
    this.setupConnection(conn, playerName);
  }

  private handleIncomingConnection(conn: DataConnection) {
    if (!this.isHost) {
      conn.close();
      return;
    }

    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      // Wait for player info from client
    });

    conn.on('data', (data: any) => {
      if (data.type === 'JOIN') {
        this.addPlayerToRoom(conn.peer, data.name);
      } else if (data.type === 'PLAYER_UPDATE') {
        this.updatePlayerData(conn.peer, data.player);
        this.broadcast(data); // Relay to others
      } else if (data.type === 'ACTION') {
        this.broadcast(data);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.removePlayerFromRoom(conn.peer);
    });
  }

  private setupConnection(conn: DataConnection, playerName: string) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      conn.send({ type: 'JOIN', name: playerName });
    });

    conn.on('data', (data: any) => {
      if (data.type === 'ROOM_UPDATE') {
        this.state = data.state;
        this.onStateChange(this.state);
      } else if (data.type === 'PLAYER_UPDATE' || data.type === 'ACTION') {
        this.onEvent(data);
      }
    });

    conn.on('close', () => {
      alert('Connection to host lost');
      window.location.reload();
    });
  }

  private addPlayerToRoom(id: string, name: string) {
    const ctCount = this.state.players.filter(p => p.team === 'CT').length;
    const tCount = this.state.players.filter(p => p.team === 'T').length;
    const teamSize = this.state.settings.teamSize;

    let team: Team = 'Spectator';
    if (ctCount < teamSize) team = 'CT';
    else if (tCount < teamSize) team = 'T';

    const newPlayer: NetworkPlayer = {
      id,
      name,
      team,
      isHost: false,
      pos: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      weapon: 'knife',
      hp: 100,
      isShooting: false
    };

    this.state.players.push(newPlayer);
    this.broadcastState();
    this.onStateChange(this.state);
  }

  private removePlayerFromRoom(id: string) {
    this.state.players = this.state.players.filter(p => p.id !== id);
    this.broadcastState();
    this.onStateChange(this.state);
  }

  private updatePlayerData(id: string, data: Partial<NetworkPlayer>) {
    const player = this.state.players.find(p => p.id === id);
    if (player) {
      Object.assign(player, data);
    }
  }

  public sendUpdate(update: any) {
    if (this.isHost) {
      this.updatePlayerData(this.peer!.id, update.player);
      this.broadcast(update);
    } else {
      const hostConn = Array.from(this.connections.values())[0];
      if (hostConn) hostConn.send(update);
    }
  }

  public broadcastState(syncData?: Partial<RoomState>) {
    if (this.isHost) {
      if (syncData) Object.assign(this.state, syncData);
      this.broadcast({ type: 'ROOM_UPDATE', state: this.state });
    }
  }

  private broadcast(data: any) {
    this.connections.forEach(conn => {
      if (conn.open) conn.send(data);
    });
  }

  public onStateUpdate(fn: (state: RoomState) => void) {
    this.onStateChange = fn;
  }

  public onNetworkEvent(fn: (event: NetworkEvent) => void) {
    this.onEvent = fn;
  }

  public startMatch() {
    if (this.isHost) {
      this.state.started = true;
      this.state.phase = 'freeze';
      this.broadcastState();
      this.onStateChange(this.state);
    }
  }

  public getMyId() { return this.peer?.id; }
}

export const roomManager = new RoomManager();

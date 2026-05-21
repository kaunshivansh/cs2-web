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
  score: { CT: number, T: number };
  round: number;
  attackSite: string;
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
    started: false,
    score: { CT: 0, T: 0 },
    round: 1,
    attackSite: 'A'
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
    this.state = {
      ...this.state,
      settings,
      players: [{
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
      }],
      code: this.peer!.id
    };
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
        this.broadcast(data, [conn.peer]); // Relay to others, except sender
      } else if (data.type === 'ACTION') {
        this.broadcast(data, [conn.peer]);
      } else if (data.type === 'REQUEST_TEAM') {
        this.handleTeamRequest(conn.peer, data.team);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.removePlayerFromRoom(conn.peer);
    });
  }

  private handleTeamRequest(id: string, team: Team) {
    const playerIndex = this.state.players.findIndex(p => p.id === id);
    if (playerIndex === -1) return;

    const teamSize = this.state.settings.teamSize;
    const count = this.state.players.filter(p => p.team === team).length;

    if (team === 'Spectator' || count < teamSize) {
      const newPlayers = [...this.state.players];
      newPlayers[playerIndex] = { ...newPlayers[playerIndex], team };
      this.state = { ...this.state, players: newPlayers };
      this.broadcastState();
      this.onStateChange(this.state);
    }
  }

  public requestTeam(team: Team) {
    if (this.isHost) {
      this.handleTeamRequest(this.peer!.id, team);
    } else {
      const hostConn = Array.from(this.connections.values())[0];
      if (hostConn) hostConn.send({ type: 'REQUEST_TEAM', team });
    }
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

    this.state = { ...this.state, players: [...this.state.players, newPlayer] };
    this.broadcastState();
    this.onStateChange(this.state);
  }

  private removePlayerFromRoom(id: string) {
    this.state = { ...this.state, players: this.state.players.filter(p => p.id !== id) };
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
      this.broadcast(update, [this.peer!.id]);
    } else {
      const hostConn = Array.from(this.connections.values())[0];
      if (hostConn && hostConn.open) hostConn.send(update);
    }
  }

  public broadcastState(syncData?: Partial<RoomState>) {
    if (this.isHost) {
      if (syncData) Object.assign(this.state, syncData);
      this.broadcast({ type: 'ROOM_UPDATE', state: this.state });
    }
  }

  private broadcast(data: any, exclude: string[] = []) {
    this.connections.forEach(conn => {
      if (conn.open && !exclude.includes(conn.peer)) conn.send(data);
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

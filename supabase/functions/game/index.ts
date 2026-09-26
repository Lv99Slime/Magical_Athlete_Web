import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
// Generated from the exact frontend engine by npm run backend:bundle.
import { createGame, applyCommand, projectState } from '../_shared/engine.js';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (message: string): never => { throw new Error(message); };
const name = (value: unknown) => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 30 ? value.trim() : fail('BAD_NICKNAME');
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
async function digest(value: unknown) {
 const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function roomFor(id: string, userId: string) {
 const { data: member, error: me } = await db.from('game_members').select('player_id').eq('room_id',id).eq('user_id',userId).maybeSingle();
 if(me) fail('DATABASE_ERROR'); if(!member) fail('NOT_MEMBER');
 const { data: room, error } = await db.from('game_rooms').select('*').eq('id',id).single();
 if(error || !room) fail('ROOM_NOT_FOUND');
 return { room, playerId: member.player_id };
}
function view(room: any, playerId: string) {
 return { id: room.id, code: room.code, version: room.version, hostId: room.state.hostId, playerId,
  members: room.state.members, game: room.state.game ? projectState(room.state.game,playerId) : null };
}
function checkedAction(action: any) {
 if(!action || typeof action!=='object' || Array.isArray(action)) fail('BAD_ACTION');
 const exact = (keys: string[]) => { if(Object.keys(action).some(k=>!['type',...keys].includes(k))) fail('BAD_ACTION'); };
 const str = (v: unknown) => typeof v==='string' && v.length>0 && v.length<160;
 switch(action.type) {
  case 'ready': exact(['ready']); if(typeof action.ready!=='boolean') fail('BAD_ACTION'); break;
  case 'start': exact(['doubleRacers','randomTeams']); for(const k of ['doubleRacers','randomTeams']) if(action[k]!==undefined && typeof action[k]!=='boolean') fail('BAD_ACTION'); break;
  case 'draft': exact(['racerId']); if(!str(action.racerId)) fail('BAD_ACTION'); break;
  case 'select': exact(['racerIds']); if(!Array.isArray(action.racerIds) || action.racerIds.length>2 || !action.racerIds.every(str)) fail('BAD_ACTION'); break;
  case 'choose': exact(['decisionId','optionId']); if(!str(action.decisionId)||!str(action.optionId)) fail('BAD_ACTION'); break;
  case 'roll': case 'nextRace': exact([]); break;
  default: fail('BAD_ACTION');
 }
 return action;
}

Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response(null,{headers});
 try {
  // Do not trust decoded JWT claims. Auth verifies the signature and live user.
  const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token) return reply({error:'UNAUTHENTICATED'},401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if(authError || !auth.user) return reply({error:'UNAUTHENTICATED'},401);
  const userId=auth.user.id;
  const path = new URL(req.url).pathname.replace(/^.*\/game(?=\/|$)/,'');
  const rate=await db.rpc('game_check_rate',{p_user:userId,p_bucket:'request'});
  if(rate.error) fail('DATABASE_ERROR'); if(!rate.data) return reply({error:'RATE_LIMITED'},429);
  if(req.method==='GET') {
   const match=path.match(/^\/rooms\/([0-9a-f-]+)$/i);
   if(!match || !uuid.test(match[1])) return reply({error:'NOT_FOUND'},404);
   const {room,playerId}=await roomFor(match[1],userId);
   return reply(view(room,playerId));
  }
  if(req.method!=='POST') return reply({error:'METHOD_NOT_ALLOWED'},405);
  const raw=await req.text(); if(raw.length>8192) return reply({error:'REQUEST_TOO_LARGE'},413);
  let body:any; try {body=JSON.parse(raw);} catch {return reply({error:'BAD_JSON'},400);}
  if(!body || typeof body!=='object' || !uuid.test(body.commandId??'')) fail('BAD_COMMAND_ID');
  const requestDigest=await digest({path,body});
  if(path==='/rooms' || path==='/rooms/join') {
   const nickname=name(body.nickname);
   let roomId:string|undefined;
   if(path==='/rooms/join') {
    const code=typeof body.code==='string'?body.code.trim().toUpperCase():'';
    if(!/^[A-Z0-9]{6}$/.test(code)) fail('BAD_ROOM_CODE');
    const {data,error}=await db.rpc('game_join',{p_user:userId,p_command:body.commandId,p_digest:requestDigest,p_code:code,p_name:nickname});
    if(error) fail(error.message); roomId=data;
   } else {
    const limit=await db.rpc('game_check_rate',{p_user:userId,p_bucket:'create'});
    if(limit.error) fail('DATABASE_ERROR'); if(!limit.data) return reply({error:'RATE_LIMITED'},429);
    for(let i=0;i<6;i++) {
     const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
     const code=Array.from({length:6},()=>alphabet[Math.floor(random()*alphabet.length)]).join('');
     const {data,error}=await db.rpc('game_create',{p_user:userId,p_command:body.commandId,p_digest:requestDigest,p_code:code,p_name:nickname});
     if(!error) {roomId=data;break;} if(error.code!=='23505') fail(error.message);
    }
    if(!roomId) fail('ROOM_CREATE_FAILED');
   }
   const {room,playerId}=await roomFor(roomId!,userId); return reply(view(room,playerId));
  }
  const match=path.match(/^\/rooms\/([0-9a-f-]+)\/actions$/i);
  if(!match || !uuid.test(match[1])) return reply({error:'NOT_FOUND'},404);
  const roomId=match[1];
  const {room,playerId}=await roomFor(roomId,userId);
  const {data:receipt,error:receiptError}=await db.from('game_commands').select('digest,room_id').eq('user_id',userId).eq('command_id',body.commandId).maybeSingle();
  if(receiptError) fail('DATABASE_ERROR');
  if(receipt) {if(receipt.digest!==requestDigest || receipt.room_id!==roomId) fail('COMMAND_REUSED'); return reply(view(room,playerId));}
  if(!Number.isInteger(body.expectedVersion) || body.expectedVersion<0) fail('BAD_VERSION');
  if(room.version!==body.expectedVersion) fail('STALE_STATE');
  const action=checkedAction(body.action);
  const state=structuredClone(room.state);
  if(action.type==='ready') {
   if(state.game) fail('GAME_STARTED');
   state.members.find((m:any)=>m.id===playerId).ready=action.ready;
  } else if(action.type==='start') {
   if(playerId!==state.hostId) fail('HOST_ONLY');
   if(state.game) fail('GAME_STARTED');
   if(state.members.length<2 || state.members.length>6 || !state.members.every((m:any)=>m.ready)) fail('NOT_READY');
   if(action.doubleRacers && state.members.length>3) fail('BAD_ACTION');
   state.game=createGame({names:state.members.map((m:any)=>m.name),doubleRacers:action.doubleRacers,randomTeams:action.randomTeams},random);
  } else {
   if(!state.game) fail('GAME_NOT_STARTED');
   try {state.game=applyCommand(state.game,{actorId:playerId,action},random);} catch {fail('ILLEGAL_ACTION');}
   if(state.game.error) fail('ENGINE_ERROR');
  }
  const oldCounter=room.state.game?.eventCounter??0;
  const events=state.game?.events.filter((e:any)=>e.id>oldCounter)??[];
  const randomOutcomes=state.game?.randomOutcomes.slice(room.state.game?.randomOutcomes.length??0)??[];
  const {error}=await db.rpc('game_commit',{p_user:userId,p_command:body.commandId,p_digest:requestDigest,p_room:roomId,p_expected:body.expectedVersion,p_state:state,p_events:events,p_action:{actorId:playerId,action},p_random:randomOutcomes});
  if(error) fail(error.message);
  const fresh=await roomFor(roomId,userId); return reply(view(fresh.room,fresh.playerId));
 } catch(error) {
  const message=error instanceof Error?error.message:'';
  const safe=['NOT_MEMBER','ROOM_NOT_FOUND','COMMAND_REUSED','STALE_STATE','GAME_STARTED','ROOM_FULL','NOT_READY','HOST_ONLY','GAME_NOT_STARTED','ILLEGAL_ACTION','ENGINE_ERROR','BAD_ACTION','BAD_VERSION','BAD_COMMAND_ID','BAD_NICKNAME','BAD_ROOM_CODE'].find(code=>message===code);
  const status=safe==='NOT_MEMBER'||safe==='HOST_ONLY'?403:safe==='ROOM_NOT_FOUND'?404:safe==='STALE_STATE'||safe==='COMMAND_REUSED'?409:safe?.startsWith('BAD_')?400:safe?422:500;
  return reply({error:safe??'SERVER_ERROR'},status);
 }
});

import racers from '../../../magical_athlete_2025_racers.json';
import tracks from '../../../magical_athlete_2025_tracks.json';
export const RACERS = racers.racers;
export const TRACKS = tracks.tracks;
export const SCHEDULE = tracks.defaultRaceSchedule;
export const racerName = (id: string) => RACERS.find(r => r.id === id)?.name ?? id;

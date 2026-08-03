export type Role = 'Coach' | 'Athlete' | 'Parent' | 'SoloAthlete' | 'Admin';

export interface User {
  id: string;       // UUID from auth
  email: string;
  fullName: string; // mapped from API's displayName
  role: Role;       // mapped from API's roles[0]
}

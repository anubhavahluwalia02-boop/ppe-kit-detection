export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Safety Officer' | 'Site Auditor' | 'Plant Supervisor' | 'HSE Manager';
  siteLocation: string;
  loginTime: string;
  avatarColor?: string;
}

export const DEMO_USERS: User[] = [
  {
    id: 'user-1',
    name: 'Anubhav Ahluwalia',
    email: 'anubhavahluwalia02@gmail.com',
    role: 'Safety Officer',
    siteLocation: 'Zone A - Fabrication Bay',
    loginTime: 'Just now',
    avatarColor: 'from-amber-500 to-emerald-600',
  },
  {
    id: 'user-2',
    name: 'Sarah Chen',
    email: 'sarah.chen@safeguard-ai.com',
    role: 'HSE Manager',
    siteLocation: 'Chemical Synthesis Facility',
    loginTime: 'Just now',
    avatarColor: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'user-3',
    name: 'Marcus Brody',
    email: 'marcus.brody@osha-inspect.org',
    role: 'Site Auditor',
    siteLocation: 'Regional Distribution Hub',
    loginTime: 'Just now',
    avatarColor: 'from-purple-500 to-pink-600',
  },
];

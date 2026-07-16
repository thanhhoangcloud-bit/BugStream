export interface User {
  id: string;
  name: string;
  pass: string;
  google_email?: string;
  avatar_url?: string;
  created_at?: string;
  role?: 'fixer' | 'reporter' | 'approver';
}

export type BugStatus = 'Pending' | 'In Progress' | 'Resolved' | 'Recheck' | 'Cancelled' | 'Closed' | 'Rejected';

export interface HistoryLog {
  timestamp: string;
  from_status: string;
  to_status: string;
  user_name: string;
  resolved_hours?: number;
  recheck_reason?: string;
}

export interface Bug {
  id: string;
  description: string;
  status: BugStatus;
  timestamp: string;
  image: string[]; // URLs from Cloudinary
  user_id: string;
  user_name?: string; // Derived field for display
  resolved_hours?: number;
  recheck_reason?: string;
  priority?: 'Low' | 'Medium' | 'High';
  history?: HistoryLog[];
}

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
}

// User Profile
export interface UserProfile {
  id: string;
  display_name: string | null;
  /** Unique public handle for friend search (@username) */
  username?: string | null;
  avatar_url: string | null;
  bio?: string | null;
  favorite_genres?: string[];
  followers_count?: number;
  following_count?: number;
  created_at: string;
  updated_at: string;
}

// User's Movie/TV List Item
export interface UserMovieListItem {
  id: string;
  user_id: string;
  movie_id: number;
  movie_title: string;
  movie_poster_path: string | null;
  media_type?: 'movie' | 'tv';
  added_at: string;
}

// Movie/TV Review
export interface Review {
  id: string;
  user_id: string;
  user_display_name: string;
  user_avatar_url: string | null;
  content_id: number;
  content_type: 'movie' | 'tv';
  content_title: string;
  content_poster_path: string | null;
  rating: number; // 1-10
  review_text: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
}

// Comment on a review or content
export interface Comment {
  id: string;
  user_id: string;
  user_display_name: string;
  user_avatar_url: string | null;
  content_id: number; // movie/tv id
  content_type: 'movie' | 'tv';
  parent_id?: string; // for nested replies
  text: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
}

// Like on a review or comment
export interface Like {
  id: string;
  user_id: string;
  target_id: string; // review_id or comment_id
  target_type: 'review' | 'comment' | 'content';
  content_id?: number; // optional, for content likes
  created_at: string;
}

// User following relationship
export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

// Watch history
export interface WatchHistory {
  id: string;
  user_id: string;
  content_id: number;
  content_type: 'movie' | 'tv';
  content_title: string;
  content_poster_path: string | null;
  season?: number;
  episode?: number;
  progress_seconds: number;
  total_duration_seconds: number;
  completed: boolean;
  watched_at: string;
}

// Notification
export interface Notification {
  id: string;
  user_id: string;
  from_user_id?: string;
  type: 'like' | 'comment' | 'follow' | 'review' | 'new_episode' | 'recommendation' | 'friend_request' | 'friend_accepted' | 'watch_party_invite' | 'watch_party_invite_declined';
  title: string;
  message: string;
  data?: {
    content_id?: number;
    content_type?: 'movie' | 'tv';
    from_user_id?: string;
    from_user_name?: string;
    review_id?: string;
    comment_id?: string;
    friend_request_id?: string;
    invite_id?: string;
    invite_status?: 'pending' | 'accepted' | 'declined';
    party_join_url?: string;
    room_id?: string;
    movie_title?: string;
  };
  read: boolean;
  created_at: string;
}

// Activity Feed Item
export interface ActivityFeedItem {
  id: string;
  user_id: string;
  user_display_name: string;
  user_avatar_url: string | null;
  type: 'review' | 'rating' | 'watchlist_add' | 'watched' | 'follow';
  content_id?: number;
  content_type?: 'movie' | 'tv';
  content_title?: string;
  content_poster_path?: string | null;
  target_user_id?: string;
  target_user_name?: string;
  rating?: number;
  review_text?: string;
  created_at: string;
}

// Content Rating (Quick star rating without review)
export interface ContentRating {
  id: string;
  user_id: string;
  content_id: number;
  content_type: 'movie' | 'tv';
  rating: number; // 1-10
  created_at: string;
  updated_at: string;
}

// FlixParty
export interface FlixPartyParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: number;
  role: 'host' | 'guest';
}

export interface FlixPartyRoom {
  id: string;
  code: string;
  hostId: string;
  encryptedPayload: string;
  playbackState: 'playing' | 'paused';
  lastKnownTime: number;
  serverIndex: number;
  updatedAt: number;
  participants: FlixPartyParticipant[];
  createdAt: number;
}

// Timeline Comment
export interface TimelineComment {
  id: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  tmdbId: number;
  timestampSeconds: number;
  text: string;
  likesCount: number;
  status: 'visible' | 'hidden';
  createdAt: string;
  updatedAt: string;
}

// Member Profile (Netflix-style multi-profile)
export type ProfileType = 'standard' | 'kids';

export interface MemberProfile {
  id: string;
  ownerId: string; // the Firebase Auth user who owns this account
  displayName: string;
  avatarUrl: string | null;
  type: ProfileType;
  isPrimary: boolean;
  pinHash?: string | null; // bcrypt hash for mature profile lock
  maxCertification?: string; // e.g. 'PG-13', 'R', 'NC-17'
  blockedGenres?: number[];
  createdAt: string;
  updatedAt: string;
}

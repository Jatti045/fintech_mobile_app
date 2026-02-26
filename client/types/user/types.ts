// ─── User Domain Types ──────────────────────────────────────────────────────

export interface ILoginData {
  email: string;
  password: string;
}

export interface ISignupData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface IUser {
  id: string;
  username: String;
  email: string;
  profilePic?: string | null;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IAuthResponse {
  success: boolean;
  message: string;
  data: {
    user: IUser;
    token: string;
  };
}

export interface UserState {
  user: IUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  loginError: string | null;
  signupError: string | null;
}

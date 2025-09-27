import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { userAPI, ILoginData, ISignupData, IUser } from "../../api/user";

// Types for the slice state
export interface UserState {
  user: IUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  loginError: string | null;
  signupError: string | null;
}

// Initial state
const initialState: UserState = {
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  loginError: null,
  signupError: null,
};

// Async thunks for API calls
export const loginUser = createAsyncThunk(
  "user/login",
  async (credentials: ILoginData, { rejectWithValue }) => {
    try {
      const response = await userAPI.login(credentials);
      return response.data; // { user, token }
    } catch (error: any) {
      // apiClient normalizes errors to an object with `message` and `status`.
      const msg =
        (error && error.message) ||
        (error && error.data && error.data.message) ||
        "Login failed";
      return rejectWithValue(msg);
    }
  }
);

export const signupUser = createAsyncThunk(
  "user/signup",
  async (userData: ISignupData, { rejectWithValue }) => {
    try {
      const response = await userAPI.signup(userData);
      return response.data;
    } catch (error: any) {
      const msg =
        (error && error.message) ||
        (error && error.data && error.data.message) ||
        "Signup failed";
      return rejectWithValue(msg);
    }
  }
);

export const logoutUser = createAsyncThunk(
  "user/logout",
  async (_, { rejectWithValue }) => {
    try {
      await userAPI.logout();
    } catch (error: any) {
      return rejectWithValue(error.message || "Logout failed");
    }
  }
);

export const deleteUserAccount = createAsyncThunk(
  "user/deleteAccount",
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await userAPI.deleteAccount(userId);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Account deletion failed");
    }
  }
);

export const loadUserFromStorage = createAsyncThunk(
  "user/loadFromStorage",
  async (_, { rejectWithValue }) => {
    try {
      const token = await userAPI.getStoredToken();
      const userData = await userAPI.getStoredUser();

      if (!token || !userData) {
        return rejectWithValue("No stored auth data");
      }

      return {
        token,
        user: userData,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to load user data");
    }
  }
);

export const uploadProfilePicture = createAsyncThunk(
  "user/uploadProfilePicture",
  async (
    { userId, imageFile }: { userId: string; imageFile: any },
    { rejectWithValue }
  ) => {
    try {
      const response = await userAPI.uploadProfilePictureById(
        userId,
        imageFile
      );

      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.message || "Failed to upload profile picture"
      );
    }
  }
);

export const deleteProfilePicture = createAsyncThunk(
  "user/deleteProfilePicture",
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await userAPI.deleteProfilePictureById(userId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.message || "Failed to delete profile picture"
      );
    }
  }
);

export const changePassword = createAsyncThunk(
  "user/changePassword",
  async (
    payload: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await userAPI.changePassword(payload);
      return response;
    } catch (error: any) {
      const msg =
        (error && error.message) ||
        (error && error.data && error.data.message) ||
        "Change password failed";
      return rejectWithValue(msg);
    }
  }
);

export const forgotPassword = createAsyncThunk(
  "user/forgotPassword",
  async (payload: { email: string }, { rejectWithValue }) => {
    try {
      const response = await userAPI.forgotPassword(payload);
      return response;
    } catch (error: any) {
      const msg =
        (error && error.message) ||
        (error && error.data && error.data.message) ||
        "Forgot password failed";
      return rejectWithValue(msg);
    }
  }
);

export const resetPassword = createAsyncThunk(
  "user/resetPassword",
  async (
    payload: {
      email: string;
      otp: string;
      newPassword?: string;
      confirmPassword?: string;
      verifyOnly?: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await userAPI.resetPassword(payload);
      return response;
    } catch (error: any) {
      const msg =
        (error && error.message) ||
        (error && error.data && error.data.message) ||
        "Reset password failed";
      return rejectWithValue(msg);
    }
  }
);

// Create the slice
const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    // Synchronous actions
    clearError: (state) => {
      state.error = null;
      state.loginError = null;
      state.signupError = null;
    },
    clearLoginError: (state) => {
      state.loginError = null;
    },
    clearSignupError: (state) => {
      state.signupError = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    resetUserState: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.loginError = null;
      state.signupError = null;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    // Login cases
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.loginError = null;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.loginError = null;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.loginError = action.payload as string;
        state.error = action.payload as string;
      })

      // Signup cases
      .addCase(signupUser.pending, (state) => {
        state.isLoading = true;
        state.signupError = null;
        state.error = null;
      })
      .addCase(signupUser.fulfilled, (state) => {
        state.isLoading = false;
        state.signupError = null;
        state.error = null;
        // Don't auto-login after signup, let user login manually
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.isLoading = false;
        state.signupError = action.payload as string;
        state.error = action.payload as string;
      })

      // Load from storage cases
      .addCase(loadUserFromStorage.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadUserFromStorage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(loadUserFromStorage.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload as string;
      })

      .addCase(deleteUserAccount.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteUserAccount.fulfilled, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = null;
        state.loginError = null;
        state.signupError = null;
      })
      .addCase(deleteUserAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Logout cases
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = null;
        state.loginError = null;
        state.signupError = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Upload profile picture cases
      .addCase(uploadProfilePicture.pending, (state) => {
        state.isLoading = false; // Set to false to avoid spinner during upload
        state.error = null;
      })
      .addCase(uploadProfilePicture.fulfilled, (state, action) => {
        console.log("action.payload:", action.payload);
        state.isLoading = false;
        state.user = {
          ...state.user,
          profilePic: action.payload.profilePic,
        } as IUser;
        state.error = null;
      })
      .addCase(uploadProfilePicture.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Delete profile picture cases - keep this local to UI (do not toggle global isLoading)
    builder
      .addCase(deleteProfilePicture.pending, (state) => {
        // handled by local component state (e.g., `deleting` in Profile screen)
        state.error = null;
      })
      .addCase(deleteProfilePicture.fulfilled, (state, action) => {
        if (state.user) state.user.profilePic = null;
        state.error = null;
      })
      .addCase(deleteProfilePicture.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    builder
      .addCase(changePassword.pending, (state) => {
        state.isLoading = false; // Set to false to avoid spinner during password change
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // forgotPassword cases
    builder
      .addCase(forgotPassword.pending, (state) => {
        state.isLoading = false; // Set to false to avoid spinner during password reset request
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // resetPassword cases
    builder
      .addCase(resetPassword.pending, (state) => {
        state.isLoading = false; // Set to false to avoid spinner during password reset
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

// Export actions
export const {
  clearError,
  clearLoginError,
  clearSignupError,
  setLoading,
  resetUserState,
} = userSlice.actions;

// Export reducer
export default userSlice.reducer;

// Selectors for easy state access
export const selectUser = (state: { user: UserState }) => state.user.user;
export const selectIsAuthenticated = (state: { user: UserState }) =>
  state.user.isAuthenticated;
export const selectIsLoading = (state: { user: UserState }) =>
  state.user.isLoading;
export const selectError = (state: { user: UserState }) => state.user.error;
export const selectLoginError = (state: { user: UserState }) =>
  state.user.loginError;
export const selectSignupError = (state: { user: UserState }) =>
  state.user.signupError;
export const selectToken = (state: { user: UserState }) => state.user.token;

import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../config/apiClient";
import { AxiosRequestConfig } from "axios";
import BaseAPI from "./base";
import { IApiResponse } from "./base";

// Types
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

class UserAPI extends BaseAPI {
  async login(
    credentials: ILoginData,
  ): Promise<IApiResponse<{ user: IUser; token: string }>> {
    try {
      const response = await this.makeRequest<{ user: IUser; token: string }>(
        "/user/login",
        {
          method: "POST",
          data: credentials,
        },
      );

      await AsyncStorage.setItem("authToken", response.data.token);
      await AsyncStorage.setItem(
        "userData",
        JSON.stringify(response.data.user),
      );

      return response;
    } catch (error: any) {
      console.error("Login failed: ", error.message);
      throw error;
    }
  }

  async signup(userData: ISignupData): Promise<IApiResponse<any>> {
    try {
      const response = await this.makeRequest<any>("/user/signup", {
        method: "POST",
        data: userData,
      });

      return response;
    } catch (error: any) {
      console.error("Signup failed:", error.message);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      // Remove stored authentication data
      // Attempt to clear user-scoped caches as well
      const rawUser = await AsyncStorage.getItem("userData");
      const userId = rawUser ? JSON.parse(rawUser)?.id : null;
      if (userId) {
        try {
          const allKeys = await AsyncStorage.getAllKeys();
          const keysToRemove = allKeys.filter(
            (k) =>
              k.startsWith(`transactions:${userId}:`) ||
              k.startsWith(`budgets:${userId}:`),
          );
          if (keysToRemove.length > 0)
            await AsyncStorage.multiRemove(keysToRemove);
        } catch (e) {
          // ignore
        }
      }

      await AsyncStorage.removeItem("authToken");
      await AsyncStorage.removeItem("userData");
    } catch (error: any) {
      console.error("Logout failed:", error.message);
      throw error;
    }
  }

  async deleteAccount(userId: string): Promise<IApiResponse<IUser>> {
    try {
      const response = await this.makeRequest<IUser>(`/user/delete/${userId}`, {
        method: "DELETE",
      });
      // Clear per-user cached data
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const keysToRemove = allKeys.filter(
          (k) =>
            k.startsWith(`transactions:${userId}:`) ||
            k.startsWith(`budgets:${userId}:`),
        );
        if (keysToRemove.length > 0)
          await AsyncStorage.multiRemove(keysToRemove);
      } catch (e) {
        // ignore
      }
      await AsyncStorage.multiRemove(["authToken", "userData"]);

      return response;
    } catch (error: any) {
      console.error("Account deletion failed:", error.message);
      throw error;
    }
  }

  async uploadProfilePictureById(
    userId: string,
    imageFile: any,
  ): Promise<IApiResponse<IUser>> {
    try {
      const formData = new FormData();

      formData.append("profilePicture", imageFile);

      const response = await apiClient.post(
        `/user/${userId}/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      console.log("Upload response:", response.data);

      const currentStoredUser = await AsyncStorage.getItem("userData");
      console.log("Current stored user before upload:", currentStoredUser);

      if (response?.data?.data) {
        await AsyncStorage.setItem(
          "userData",
          JSON.stringify(response.data.data),
        );
      } else {
        console.error("Upload response missing user object", response?.data);
      }

      return response.data;
    } catch (error: any) {
      console.error("Upload profile picture by ID failed:", error.message);
      throw error;
    }
  }

  async deleteProfilePictureById(userId: string): Promise<IApiResponse<IUser>> {
    try {
      const response = await this.makeRequest<IUser>(
        `/user/${userId}/profile-picture`,
        {
          method: "DELETE",
        },
      );

      // Update stored user if returned
      if (response?.data) {
        try {
          await AsyncStorage.setItem("userData", JSON.stringify(response.data));
        } catch (e) {
          // ignore storage errors
        }
      }

      return response;
    } catch (error: any) {
      console.error("Delete profile picture failed:", error.message);
      throw error;
    }
  }

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<IApiResponse<any>> {
    try {
      const response = await this.makeRequest<any>(`/user/change-password`, {
        method: "POST",
        data: payload,
      });
      return response;
    } catch (error: any) {
      console.error("Change password failed:", error.message);
      throw error;
    }
  }

  async forgotPassword(email: { email: string }): Promise<IApiResponse<any>> {
    try {
      const response = await this.makeRequest<any>(`/user/forgot-password`, {
        method: "POST",
        data: email,
      });
      return response;
    } catch (error: any) {
      console.error("Forgot password failed:", error.message);
      throw error;
    }
  }

  async resetPassword(payload: {
    email: string;
    otp: string;
    newPassword?: string;
    confirmPassword?: string;
    verifyOnly?: boolean;
  }): Promise<IApiResponse<any>> {
    try {
      const response = await this.makeRequest<any>(`/user/reset-password`, {
        method: "POST",
        data: payload,
      });
      return response;
    } catch (error: any) {
      console.error("Reset password failed:", error.message);
      throw error;
    }
  }

  async updateCurrency(currency: string): Promise<IApiResponse<IUser>> {
    try {
      const response = await this.makeRequest<IUser>("/user/currency", {
        method: "PUT",
        data: { currency },
      });

      // Update stored user with new currency
      if (response?.data) {
        try {
          await AsyncStorage.setItem("userData", JSON.stringify(response.data));
        } catch (e) {
          // ignore storage errors
        }
      }

      return response;
    } catch (error: any) {
      console.error("Update currency failed:", error.message);
      throw error;
    }
  }

  // Utility Methods
  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem("authToken");
    } catch (error) {
      console.error("Failed to get stored token:", error);
      return null;
    }
  }

  async getStoredUser(): Promise<IUser | null> {
    try {
      const userData = await AsyncStorage.getItem("userData");
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error("Failed to get stored user:", error);
      return null;
    }
  }
}

// Export singleton instance
export const userAPI = new UserAPI();

// Export default
export default userAPI;

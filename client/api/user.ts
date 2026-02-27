import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../config/apiClient";
import { AxiosRequestConfig } from "axios";
import BaseAPI from "./base";
import type { IApiResponse } from "@/types/api/types";
import {
  type ILoginData,
  type ISignupData,
  type IUser,
  type IAuthResponse,
} from "@/types/user/types";

export type { ILoginData, ISignupData, IUser, IAuthResponse };

/**
 * Clears all per-user cache entries and auth tokens from AsyncStorage.
 * Shared by `logout()` and `deleteAccount()` to avoid duplication.
 */
async function clearUserStorage(userId?: string | null): Promise<void> {
  if (userId) {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(
        (k) =>
          k.startsWith(`transactions:${userId}:`) ||
          k.startsWith(`budgets:${userId}:`),
      );
      if (keysToRemove.length > 0) await AsyncStorage.multiRemove(keysToRemove);
    } catch {
      // ignore
    }
  }
  await AsyncStorage.multiRemove(["authToken", "userData"]);
}

class UserAPI extends BaseAPI {
  async login(
    credentials: ILoginData,
  ): Promise<IApiResponse<{ user: IUser; token: string }>> {
    const response = await this.makeRequest<{ user: IUser; token: string }>(
      "/user/login",
      { method: "POST", data: credentials },
    );

    await AsyncStorage.setItem("authToken", response.data.token);
    await AsyncStorage.setItem("userData", JSON.stringify(response.data.user));

    return response;
  }

  async signup(userData: ISignupData): Promise<IApiResponse<any>> {
    return this.makeRequest<any>("/user/signup", {
      method: "POST",
      data: userData,
    });
  }

  async logout(): Promise<void> {
    const rawUser = await AsyncStorage.getItem("userData");
    const userId = rawUser ? JSON.parse(rawUser)?.id : null;
    await clearUserStorage(userId);
  }

  async deleteAccount(userId: string): Promise<IApiResponse<IUser>> {
    const response = await this.makeRequest<IUser>(`/user/delete/${userId}`, {
      method: "DELETE",
    });
    await clearUserStorage(userId);
    return response;
  }

  async uploadProfilePictureById(
    userId: string,
    imageFile: any,
  ): Promise<IApiResponse<IUser>> {
    const formData = new FormData();
    formData.append("profilePicture", imageFile);

    const response = await apiClient.post(`/user/${userId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (response?.data?.data) {
      await AsyncStorage.setItem(
        "userData",
        JSON.stringify(response.data.data),
      );
    }

    return response.data;
  }

  async deleteProfilePictureById(userId: string): Promise<IApiResponse<IUser>> {
    const response = await this.makeRequest<IUser>(
      `/user/${userId}/profile-picture`,
      { method: "DELETE" },
    );

    if (response?.data) {
      try {
        await AsyncStorage.setItem("userData", JSON.stringify(response.data));
      } catch {
        // ignore storage errors
      }
    }

    return response;
  }

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<IApiResponse<any>> {
    return this.makeRequest<any>("/user/change-password", {
      method: "POST",
      data: payload,
    });
  }

  async forgotPassword(email: { email: string }): Promise<IApiResponse<any>> {
    return this.makeRequest<any>("/user/forgot-password", {
      method: "POST",
      data: email,
    });
  }

  async resetPassword(payload: {
    email: string;
    otp: string;
    newPassword?: string;
    confirmPassword?: string;
    verifyOnly?: boolean;
  }): Promise<IApiResponse<any>> {
    return this.makeRequest<any>("/user/reset-password", {
      method: "POST",
      data: payload,
    });
  }

  async updateCurrency(currency: string): Promise<IApiResponse<IUser>> {
    const response = await this.makeRequest<IUser>("/user/currency", {
      method: "PUT",
      data: { currency },
    });

    if (response?.data) {
      try {
        await AsyncStorage.setItem("userData", JSON.stringify(response.data));
      } catch {
        // ignore storage errors
      }
    }

    return response;
  }

  // Utility Methods
  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem("authToken");
    } catch {
      return null;
    }
  }

  async getStoredUser(): Promise<IUser | null> {
    try {
      const userData = await AsyncStorage.getItem("userData");
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const userAPI = new UserAPI();

// Export default
export default userAPI;

// ─── useProfile Hook ────────────────────────────────────────────────────────
// Single source of truth for all profile-screen state, side-effects, and
// handler logic.  The profile screen composes dumb sub-components that
// receive slices of this hook's return value as props.

import { useState, useEffect, useCallback } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";

import {
  useAppDispatch,
  useAppSelector,
  useAuth,
  useCalendar,
  useTheme,
} from "@/hooks/useRedux";
import {
  deleteUserAccount,
  logoutUser,
  uploadProfilePicture,
  deleteProfilePicture,
  changePassword,
  updateUserCurrency,
  updateUserMonthlyIncome,
} from "@/store/slices/userSlice";
import { setTheme } from "@/store/slices/themeSlice";
import {
  persistNotificationPreferences,
  setPurchaseRemindersEnabled,
  setBillRemindersEnabled,
  setNotificationPermissionStatus,
  selectNotificationTimezone,
  selectPurchaseRemindersEnabled,
  selectBillRemindersEnabled,
  selectNotificationPermissionStatus,
} from "@/store/slices/notificationSlice";
import { userAPI } from "@/api/user";
import { plaidAPI } from "@/api/plaid";
import { api } from "@/store/api/apiSlice";
import { requestPermission } from "@/utils/notifications/permissions";
import type { LinkSuccess } from "react-native-plaid-link-sdk";

import { useThemedAlert } from "@/utils/themedAlert";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { clearRatesCache } from "@/utils/currencyConverter";
import { DEFAULT_CURRENCY } from "@/constants/Currencies";
import { pickProfileImage, persistTheme } from "@/utils/profile/profileService";

import type { DeleteAccountPayload, SettingsItem } from "@/types/profile/types";
import type { IPlaidItem } from "@/types/plaid/types";

// ─── Return type (explicit so consumers get autocomplete) ───────────────────

export interface UseProfileReturn {
  /** Redux user object */
  user: ReturnType<typeof useAuth>["user"];
  /** Theme colours & selected theme name */
  THEME: ReturnType<typeof useTheme>["THEME"];
  selectedTheme: string;

  /** Loading / overlay flags */
  uploading: boolean;
  deleting: boolean;
  refreshing: boolean;

  /** Pull-to-refresh callback */
  onRefresh: () => Promise<void>;

  /** Avatar handlers */
  handlePickImage: () => Promise<void>;
  handleDeleteImage: () => void;

  /** Theme handler */
  handleThemeSelect: (name: string) => Promise<void>;

  /** Currency picker state & handler */
  currencyPickerOpen: boolean;
  setCurrencyPickerOpen: (open: boolean) => void;
  handleCurrencySelect: (code: string) => void;

  /** Selected calendar context */
  selectedMonthLabel: string;

  /** Monthly income input + save */
  monthlyIncomeInput: string;
  setMonthlyIncomeInput: (value: string) => void;
  handleSaveMonthlyIncome: () => Promise<void>;
  monthlyIncomeSaving: boolean;
  /** Actual inflow (sum of income transactions) for the selected month. */
  actualMonthlyIncome: number;

  /** Change-password modal state & handler */
  changeOpen: boolean;
  closeChangeModal: () => void;
  openChangeModal: () => void;
  handleChangePassword: (
    current: string,
    next: string,
    confirm: string,
  ) => Promise<void>;
  pwSaving: boolean;

  /** Settings list items (log out, change pw, delete) */
  settingsItems: SettingsItem[];

  /** Bank connection (Plaid Link) state + handler */
  linking: boolean;
  handleLinkBank: () => Promise<void>;

  /** Active bank connections + loading/disconnect state */
  plaidItems: IPlaidItem[];
  loadingItems: boolean;
  disconnectingId: string | null;
  /** Confirmation-gated disconnect flow for a connected bank item */
  handleDisconnectBank: (item: IPlaidItem) => void;

  /** The item just connected via Plaid Link, or null when no dialog is shown. */
  connectedItem: IPlaidItem | null;
  setConnectedItem: (item: IPlaidItem | null) => void;

  /** Purchase-reminder preference state + toggle handler */
  purchaseRemindersEnabled: boolean;
  /** Upcoming-bill reminder preference state + toggle handler */
  billRemindersEnabled: boolean;
  /** True when notifications are not permitted on this device */
  notificationPermissionDenied: boolean;
  handleTogglePurchaseReminders: (enabled: boolean) => void;
  handleToggleBillReminders: (enabled: boolean) => void;
  /** Opens the device settings where notification permission can be changed. */
  openNotificationSettings: () => void;
}

// ─── Hook Implementation ────────────────────────────────────────────────────

export function useProfile(): UseProfileReturn {
  const dispatch = useAppDispatch();
  const { user, error } = useAuth();
  const calendar = useCalendar();
  const { THEME, selectedTheme } = useTheme();
  const { showAlert } = useThemedAlert();

  // ── local state ──────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [monthlyIncomeSaving, setMonthlyIncomeSaving] = useState(false);
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState("");
  const [actualMonthlyIncome, setActualMonthlyIncome] = useState(0);
  const selectedMonthLabel = `${calendar.year}-${String(calendar.month + 1).padStart(2, "0")}`;

  // ── bank connection (Plaid Link) state ────────────────────────────────────
  const [linking, setLinking] = useState(false);
  const [plaidItems, setPlaidItems] = useState<IPlaidItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  // The item linked in the most recent Plaid Link flow; drives the
  // post-connection "your transactions are now syncing" dialog.
  const [connectedItem, setConnectedItem] = useState<IPlaidItem | null>(null);

  // Load the connected-banks list once on mount (and on pull-to-refresh).
  const loadPlaidItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const response = await plaidAPI.fetchItems();
      setPlaidItems(response?.data?.items ?? []);
    } catch {
      // Swallow — the connect row remains usable and refresh will retry.
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    loadPlaidItems();
  }, [loadPlaidItems]);

  // ── notification preference state ─────────────────────────────────────────
  const purchaseRemindersEnabled = useAppSelector(
    selectPurchaseRemindersEnabled,
  );
  const billRemindersEnabled = useAppSelector(selectBillRemindersEnabled);
  const notificationTimezone = useAppSelector(selectNotificationTimezone);
  const permissionStatus = useAppSelector(selectNotificationPermissionStatus);
  const notificationPermissionDenied = permissionStatus === "denied";

  const handleTogglePurchaseReminders = useCallback(
    async (value: boolean) => {
      if (value) {
        // Enabling: ask for OS permission first (only when we still can), then
        // persist whatever the OS actually allows. Never claim notifications
        // are enabled when permission is denied.
        let permission = permissionStatus;
        if (permission === "undetermined") {
          permission = await requestPermission();
          dispatch(setNotificationPermissionStatus(permission));
        }
        if (permission === "granted") {
          dispatch(setPurchaseRemindersEnabled(true));
          await persistNotificationPreferences({
            purchaseRemindersEnabled: true,
            billRemindersEnabled,
            timezone: notificationTimezone,
          });
          return;
        }
        // Permission is denied or still undetermined (user cancelled): keep the
        // preference off and route to system settings when that's required.
        dispatch(setPurchaseRemindersEnabled(false));
        await persistNotificationPreferences({
          purchaseRemindersEnabled: false,
          billRemindersEnabled,
          timezone: notificationTimezone,
        });
        if (permission === "denied") {
          showAlert({
            title: "Notifications are off",
            message:
              "Budgee doesn't have notification permission. Enable it in your device settings to receive reminders.",
            buttons: [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
          });
        }
        return;
      }

      // Disabling: turn the preference off; the notification lifecycle hook
      // cancels any scheduled reminders.
      dispatch(setPurchaseRemindersEnabled(false));
      await persistNotificationPreferences({
        purchaseRemindersEnabled: false,
        billRemindersEnabled,
        timezone: notificationTimezone,
      });
    },
    [
      dispatch,
      permissionStatus,
      notificationTimezone,
      billRemindersEnabled,
      showAlert,
    ],
  );

  /**
   * Toggles upcoming-bill reminders. No OS permission dance needed here:
   * bill reminders ride the same permission grant as purchase reminders,
   * and the lifecycle hook applies the change on its next sync.
   */
  const handleToggleBillReminders = useCallback(
    async (value: boolean) => {
      dispatch(setBillRemindersEnabled(value));
      await persistNotificationPreferences({
        purchaseRemindersEnabled,
        billRemindersEnabled: value,
        timezone: notificationTimezone,
      });
    },
    [dispatch, purchaseRemindersEnabled, notificationTimezone],
  );

  /** Opens the OS settings screen where notification permission lives. */
  const openNotificationSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  const loadMonthlyIncomeForSelectedMonth = useCallback(async () => {
    if (!user?.id) {
      setMonthlyIncomeInput("");
      return;
    }

    try {
      const response = await userAPI.getMonthlyIncome({
        month: calendar.month,
        year: calendar.year,
      });
      setMonthlyIncomeInput(String(Number(response?.data?.monthlyIncome ?? 0)));
      setActualMonthlyIncome(Number(response?.data?.actualMonthlyIncome ?? 0));
    } catch {
      setMonthlyIncomeInput("");
      setActualMonthlyIncome(0);
    }
  }, [user?.id, calendar.month, calendar.year]);

  useEffect(() => {
    loadMonthlyIncomeForSelectedMonth();
  }, [loadMonthlyIncomeForSelectedMonth]);

  // ── show Redux-level errors as alerts ────────────────────────────────────
  useEffect(() => {
    if (error) showAlert({ title: "Error", message: error });
  }, [error]);

  // ── pull-to-refresh ──────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Revalidate the Profile's server-backed data only. Do NOT re-run
      // the boot-time session restoration (loadUserFromStorage): that
      // thunk flips the global auth `isLoading` flag, which the root
      // layout otherwise treats as an app-restore moment and swaps the
      // navigator for the splash screen — remounting the tab stack
      // lands the user back on Home. The stored session is already in
      // Redux; a refresh only re-fetches data that can go stale.
      await loadMonthlyIncomeForSelectedMonth();
      await loadPlaidItems();
    } finally {
      setRefreshing(false);
    }
  }, [loadMonthlyIncomeForSelectedMonth, loadPlaidItems]);

  // ── bank connection (Plaid Link) flow ─────────────────────────────────────
  const handleLinkBank = async () => {
    setLinking(true);
    try {
      // Lazy-load the native Plaid Link SDK only when the user actually taps
      // "Connect a bank". The SDK resolves its native TurboModule at import
      // time, so a top-level import would crash the whole Profile screen when
      // the native module hasn't been linked into a rebuilt app yet.
      let plaidModule: any;
      try {
        plaidModule = require("react-native-plaid-link-sdk");
      } catch (e: any) {
        setLinking(false);
        showAlert({
          title: "Plaid Not Linked",
          message: `Bank linking needs the native Plaid SDK in this app build. Details: ${
            e?.message || "native module missing"
          }`,
        });
        return;
      }

      const createPlaidLinkSession = plaidModule?.createPlaidLinkSession;
      if (typeof createPlaidLinkSession !== "function") {
        setLinking(false);
        showAlert({
          title: "Plaid Not Available",
          message:
            "The installed app was built without the Plaid SDK. Rebuild and reinstall the development client.",
        });
        return;
      }

      const response = await plaidAPI.createLinkToken();
      const linkToken = response?.data?.linkToken;
      if (!linkToken) {
        throw new Error("Plaid could not create a link token.");
      }

      const handler = await createPlaidLinkSession({
        token: linkToken,
        onSuccess: async (success: LinkSuccess) => {
          try {
            const exchangeResponse = await plaidAPI.exchangePublicToken(
              success.publicToken,
            );
            // Immediately surface the newly connected bank in the list.
            const item = exchangeResponse?.data?.item;
            if (item) {
              setPlaidItems((prev) =>
                prev.some((existing) => existing.id === item.id)
                  ? prev
                  : [item, ...prev],
              );
              // Surface the post-connection dialog. This is shown EVERY time a
              // new bank is connected — not just the first one.
              setConnectedItem(item);
            }
            // Surface newly-synced transactions for the selected month:
            // invalidate the month tags so RTK Query refetches the
            // transactions, budgets and financial summary.
            const monthTag = { year: calendar.year, month: calendar.month };
            dispatch(
              api.util.invalidateTags([
                {
                  type: "Transactions",
                  id: `${monthTag.year}-${monthTag.month}`,
                },
                { type: "Budgets", id: `${monthTag.year}-${monthTag.month}` },
                { type: "Summary", id: `${monthTag.year}-${monthTag.month}` },
              ]),
            );
          } catch (e) {
            showAlert({
              title: "Connection Failed",
              message: extractErrorMessage(e, "Failed to connect your bank."),
            });
          } finally {
            setLinking(false);
          }
        },
        onExit: () => setLinking(false),
        onEvent: () => {},
      });
      await handler.open();
    } catch (e) {
      setLinking(false);
      showAlert({
        title: "Connection Failed",
        message: extractErrorMessage(e, "Failed to start bank connection."),
      });
    }
  };

  // ── disconnect a connected bank ──────────────────────────────────────────
  // Performs the DELETE after the user confirms in the themed alert.
  const disconnectBank = useCallback(
    async (item: IPlaidItem) => {
      setDisconnectingId(item.id);
      try {
        const response = await plaidAPI.disconnectItem(item.id);
        if (response?.success) {
          setPlaidItems((prev) => prev.filter((it) => it.id !== item.id));
          showAlert({
            title: "Bank Disconnected",
            message: `${item.institutionName || "Bank"} has been disconnected from your account.`,
          });
        } else {
          showAlert({
            title: "Disconnect Failed",
            message: response?.message || "Failed to disconnect the bank.",
          });
        }
      } catch (e) {
        showAlert({
          title: "Disconnect Failed",
          message: extractErrorMessage(e, "Failed to disconnect the bank."),
        });
      } finally {
        setDisconnectingId(null);
      }
    },
    [showAlert],
  );

  const handleDisconnectBank = useCallback(
    (item: IPlaidItem) => {
      const name = item.institutionName || "Bank";
      showAlert({
        title: "Disconnect Bank?",
        message: `Disconnect ${name}? Your already-synced transactions will remain in Budgee.`,
        buttons: [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: () => {
              void disconnectBank(item);
            },
          },
        ],
      });
    },
    [showAlert, disconnectBank],
  );

  // ── avatar ───────────────────────────────────────────────────────────────
  const handlePickImage = useCallback(async () => {
    const picked = await pickProfileImage();
    if (!picked) {
      // null means permission denied OR user cancelled
      // only alert when it was a permission issue (URI is absent)
      if (picked === null) {
        // We can't distinguish cancel vs denied from the service return,
        // but the native picker already shows nothing on cancel.
      }
      return;
    }
    if (!user?.id) return;

    try {
      setUploading(true);
      const result = await dispatch(
        uploadProfilePicture({ userId: user.id, imageFile: picked }),
      );
      if (uploadProfilePicture.fulfilled.match(result)) {
        router.push("/(tabs)/profile");
      } else if (uploadProfilePicture.rejected.match(result)) {
        showAlert({
          title: "Upload Failed",
          message:
            (result.payload as string) || "Failed to upload profile picture",
        });
      }
    } catch {
      showAlert({
        title: "Upload Failed",
        message: "An unexpected error occurred",
      });
    } finally {
      setUploading(false);
    }
  }, [dispatch, user?.id, showAlert]);

  const handleDeleteImage = useCallback(() => {
    showAlert({
      title: "Delete Profile Picture",
      message: "Are you sure you want to delete your profile picture?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) return;
            try {
              setDeleting(true);
              const res: any = await dispatch(deleteProfilePicture(user.id));
              if (deleteProfilePicture.fulfilled.match(res)) {
                showAlert({
                  title: "Deleted",
                  message: "Profile picture deleted.",
                });
              } else {
                showAlert({
                  title: "Deletion Failed",
                  message:
                    (res.payload as string) ||
                    "Failed to delete profile picture",
                });
              }
            } catch (e: any) {
              showAlert({
                title: "Deletion Failed",
                message: e?.message || "Failed to delete profile picture",
              });
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    });
  }, [dispatch, user?.id, showAlert]);

  // ── theme ────────────────────────────────────────────────────────────────
  const handleThemeSelect = useCallback(
    async (themeName: string) => {
      dispatch(setTheme(themeName));
      await persistTheme(themeName);
      showAlert({
        title: "Theme Changed",
        message: `Theme changed to ${themeName}`,
      });
    },
    [dispatch, showAlert],
  );

  // ── currency ─────────────────────────────────────────────────────────────
  const handleCurrencySelect = useCallback(
    (code: string) => {
      const isSelected = code === (user?.currency || DEFAULT_CURRENCY);
      setCurrencyPickerOpen(false);
      if (isSelected) return;

      (async () => {
        try {
          const hasTransactions = await userAPI.hasAnyTransactions();
          if (hasTransactions) {
            showAlert({
              title: "Currency Locked",
              message:
                "You cannot change your default currency because transactions already exist.",
            });
            return;
          }

          const result = await dispatch(updateUserCurrency(code));
          if (updateUserCurrency.fulfilled.match(result)) {
            clearRatesCache();
            dispatch(api.util.resetApiState());
            dispatch(
              api.util.invalidateTags([
                { type: "Transactions" },
                { type: "Budgets" },
                { type: "Summary" },
                { type: "Suggestions" },
                { type: "Recurring" },
                { type: "Insights" },
              ]),
            );
            showAlert({
              title: "Currency Updated",
              message: `Default currency changed to ${code}`,
            });
          } else {
            showAlert({
              title: "Error",
              message:
                (result.payload as string) || "Failed to update currency",
            });
          }
        } catch (e: any) {
          showAlert({
            title: "Error",
            message: e?.message || "Failed to update currency",
          });
        }
      })();
    },
    [dispatch, user?.currency, showAlert],
  );

  const handleSaveMonthlyIncome = useCallback(async () => {
    const parsed = Number(monthlyIncomeInput);
    if (isNaN(parsed) || parsed < 0) {
      showAlert({
        title: "Invalid monthly income",
        message: "Please enter a non-negative number.",
      });
      return;
    }

    setMonthlyIncomeSaving(true);
    try {
      const result = await dispatch(
        updateUserMonthlyIncome({
          monthlyIncome: parsed,
          month: calendar.month,
          year: calendar.year,
        }),
      );
      if (updateUserMonthlyIncome.fulfilled.match(result)) {
        await loadMonthlyIncomeForSelectedMonth();
        // The expected income feeds the month's financial summary; invalidate
        // the tag so Home/Transaction headers reflect the new baseline.
        dispatch(
          api.util.invalidateTags([
            {
              type: "Summary",
              id: `${calendar.year}-${calendar.month}`,
            },
          ]),
        );
        showAlert({
          title: "Monthly income updated",
          message: `Your monthly income is now ${parsed.toFixed(2)} ${user?.currency || DEFAULT_CURRENCY}.`,
        });
      } else {
        showAlert({
          title: "Error",
          message:
            (result.payload as string) || "Failed to update monthly income",
        });
      }
    } catch (e: any) {
      showAlert({
        title: "Error",
        message: e?.message || "Failed to update monthly income",
      });
    } finally {
      setMonthlyIncomeSaving(false);
    }
  }, [
    dispatch,
    monthlyIncomeInput,
    showAlert,
    user?.currency,
    calendar.month,
    calendar.year,
    loadMonthlyIncomeForSelectedMonth,
  ]);

  // ── change password ──────────────────────────────────────────────────────
  const openChangeModal = useCallback(() => setChangeOpen(true), []);
  const closeChangeModal = useCallback(() => setChangeOpen(false), []);

  const handleChangePassword = useCallback(
    async (current: string, next: string, confirm: string) => {
      if (!current || !next || !confirm) {
        showAlert({ title: "Please fill all fields" });
        return;
      }
      if (next !== confirm) {
        showAlert({ title: "New passwords do not match" });
        return;
      }
      setPwSaving(true);
      try {
        const response: any = await dispatch(
          changePassword({
            currentPassword: current,
            newPassword: next,
            confirmPassword: confirm,
          }),
        );
        if (changePassword.fulfilled.match(response)) {
          showAlert({
            title: "Success",
            message: response.payload?.message || "Password changed",
          });
          setChangeOpen(false);
        } else {
          const err =
            response.payload ||
            response.error?.message ||
            "Failed to change password";
          showAlert({ title: "Error", message: err });
        }
      } catch (e: any) {
        showAlert({
          title: "Error",
          message: e?.message || "Failed to change password",
        });
      } finally {
        setPwSaving(false);
      }
    },
    [dispatch, showAlert],
  );

  // ── logout & delete account ──────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    showAlert({
      title: "Confirm Logout",
      message: "Are you sure you want to log out?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: () => {
            dispatch(logoutUser());
            // Drop all cached server data for the signed-out user.
            dispatch(api.util.resetApiState());
          },
        },
      ],
    });
  }, [dispatch, showAlert]);

  const handleDeleteAccount = useCallback(() => {
    showAlert({
      title: "Confirm Delete Account",
      message: "Are you sure you want to delete your account?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setTimeout(() => {
              showAlert({
                title: "Delete Account",
                message:
                  "This action is permanent. Once you delete your account, all your data will be lost and cannot be recovered. Are you absolutely sure you want to continue?",
                buttons: [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      if (!user?.id) return;
                      const response = await dispatch(
                        deleteUserAccount(user.id),
                      );
                      const { success, message } =
                        response.payload as DeleteAccountPayload;
                      if (success) {
                        // Drop all cached server data for the deleted account.
                        dispatch(api.util.resetApiState());
                        showAlert({
                          title: "Account Deleted",
                          message:
                            "Your account has been deleted successfully.",
                        });
                        router.push("/login");
                      } else {
                        showAlert({
                          title: "Deletion Failed",
                          message: message || "Failed to delete account.",
                        });
                      }
                    },
                  },
                ],
              });
            }, 400);
          },
        },
      ],
    });
  }, [dispatch, user?.id, showAlert]);

  // ── settings list ────────────────────────────────────────────────────────
  const settingsItems: SettingsItem[] = [
    { title: "Log Out", icon: "log-out-outline", onPress: handleLogout },
    {
      title: "Change Password",
      icon: "key-outline",
      onPress: openChangeModal,
    },
    {
      title: "Delete Account",
      icon: "chevron-forward",
      onPress: handleDeleteAccount,
      isDestructive: true,
    },
  ];

  // ── public API ───────────────────────────────────────────────────────────
  return {
    user,
    THEME,
    selectedTheme,
    uploading,
    deleting,
    refreshing,
    onRefresh,
    handlePickImage,
    handleDeleteImage,
    handleThemeSelect,
    currencyPickerOpen,
    setCurrencyPickerOpen,
    handleCurrencySelect,
    selectedMonthLabel,
    monthlyIncomeInput,
    setMonthlyIncomeInput,
    handleSaveMonthlyIncome,
    monthlyIncomeSaving,
    actualMonthlyIncome,
    changeOpen,
    closeChangeModal,
    openChangeModal,
    handleChangePassword,
    pwSaving,
    settingsItems,
    purchaseRemindersEnabled,
    billRemindersEnabled,
    notificationPermissionDenied,
    handleTogglePurchaseReminders,
    handleToggleBillReminders,
    openNotificationSettings,
    linking,
    handleLinkBank,
    plaidItems,
    loadingItems,
    disconnectingId,
    handleDisconnectBank,
    connectedItem,
    setConnectedItem,
  };
}

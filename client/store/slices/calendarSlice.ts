import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { CalendarState } from "@/types/calendar/types";

export type { CalendarState };

const now = new Date();

const initialState: CalendarState = {
  month: now.getMonth(),
  year: now.getFullYear(),
};

const calendarSlice = createSlice({
  name: "calendar",
  initialState,
  reducers: {
    setMonthYear(
      state,
      action: PayloadAction<{ month: number; year: number }>,
    ) {
      state.month = action.payload.month;
      state.year = action.payload.year;
    },
    nextMonth(state) {
      // Get the current date
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // Calculate the next month
      let nextMonth = state.month;
      let nextYear = state.year;

      if (state.month === 11) {
        nextMonth = 0;
        nextYear = state.year + 1;
      } else {
        nextMonth = state.month + 1;
      }

      // Only allow navigation if the next month is not in the future
      if (
        nextYear < currentYear ||
        (nextYear === currentYear && nextMonth <= currentMonth)
      ) {
        state.month = nextMonth;
        state.year = nextYear;
      }
      // If trying to navigate to a future month, do nothing (stay at current state)
    },
    prevMonth(state) {
      if (state.month === 0) {
        state.month = 11;
        state.year -= 1;
      } else {
        state.month -= 1;
      }
    },
  },
});

export const { setMonthYear, nextMonth, prevMonth } = calendarSlice.actions;

export default calendarSlice.reducer;

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface CalendarState {
  month: number; // 0-11
  year: number; // full year
}

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
      action: PayloadAction<{ month: number; year: number }>
    ) {
      state.month = action.payload.month;
      state.year = action.payload.year;
    },
    nextMonth(state) {
      if (state.month === 11) {
        state.month = 0;
        state.year += 1;
      } else {
        state.month += 1;
      }
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

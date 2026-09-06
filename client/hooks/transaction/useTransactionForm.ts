import { useState } from "react";
import { useCalendar, useAuth } from "../useRedux";
import { current } from "@reduxjs/toolkit";
import { TransactionType } from "@/types/transaction/types";
import { DEFAULT_CURRENCY } from "@/constants/Currencies";

export const useTransactionForm = () => {
  const calendar = useCalendar();
  const { user } = useAuth();
  const currentMonth = calendar.month;
  const currentYear = calendar.year;

  const userCurrency = user?.currency || DEFAULT_CURRENCY;

  // Default to expense; the user can switch to income in the transaction modal.
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const monthStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
  const today = new Date();
  const isCurrentMonth =
    currentYear === today.getUTCFullYear() &&
    currentMonth === today.getUTCMonth();
  const monthEndDate = isCurrentMonth
    ? new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
          23,
          59,
          59,
        ),
      )
    : new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59));

  const [txName, setTxName] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(
    isCurrentMonth
      ? new Date()
      : new Date(Date.UTC(currentYear, currentMonth, 1, 12, 0, 0)),
  );
  const [txSelectedCategoryAndId, setTxSelectedCategoryAndId] = useState({
    id: "",
    name: "",
  });
  const [txCurrency, setTxCurrency] = useState(userCurrency);

  return {
    txName,
    setTxName,
    txAmount,
    setTxAmount,
    txDate,
    setTxDate,
    txSelectedCategoryAndId,
    setTxSelectedCategoryAndId,
    txCurrency,
    setTxCurrency,
    userCurrency,
    type,
    setType,
    monthStartDate,
    monthEndDate,
    currentMonth,
    currentYear,
  };
};

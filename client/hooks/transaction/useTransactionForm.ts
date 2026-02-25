import { useState } from "react";
import { useCalendar } from "../useRedux";
import { current } from "@reduxjs/toolkit";
import { TransactionType } from "@/api/transaction";

export const useTransactionForm = () => {
  const calendar = useCalendar();
  const currentMonth = calendar.month;
  const currentYear = calendar.year;

  const type = TransactionType.EXPENSE; // default to expense, can be extended to support income if needed
  const monthStartDate = new Date(currentYear, currentMonth, 1);
  const monthEndDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

  const [txName, setTxName] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(new Date());
  const [txSelectedCategoryAndId, setTxSelectedCategoryAndId] = useState({
    id: "",
    name: "",
  });

  return {
    txName,
    setTxName,
    txAmount,
    setTxAmount,
    txDate,
    setTxDate,
    txSelectedCategoryAndId,
    setTxSelectedCategoryAndId,
    monthStartDate,
    monthEndDate,
    currentMonth,
    currentYear,
    type,
  };
};

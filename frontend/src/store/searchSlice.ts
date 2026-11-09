
import {
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";

interface SearchState {
  query: string;
  submittedQuery: string;
}

const initialState: SearchState = {
  query: "",
  submittedQuery: "",
};

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    setSearchQuery: (
      state,
      action: PayloadAction<string>
    ) => {
      state.query = action.payload;
    },

    submitSearch: (state) => {
      state.submittedQuery = state.query.trim();
    },

    clearSearchQuery: (state) => {
      state.query = "";
      state.submittedQuery = "";
    },
  },
});

export const {
  setSearchQuery,
  submitSearch,
  clearSearchQuery,
} = searchSlice.actions;

export default searchSlice.reducer;

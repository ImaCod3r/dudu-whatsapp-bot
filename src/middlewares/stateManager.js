const userStates = {};

export const stateManager = {
  get: (chatId) => {
    if (!userStates[chatId]) {
      userStates[chatId] = { step: "init", history: [] };
    }
    return userStates[chatId];
  },
  update: (chatId, updates) => {
    const currentState = stateManager.get(chatId);
    userStates[chatId] = { ...currentState, ...updates };
    return userStates[chatId];
  },
  reset: (chatId) => {
    userStates[chatId] = { step: "init", history: [] };
    return userStates[chatId];
  },
};

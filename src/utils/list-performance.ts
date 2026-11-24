/** Render a small viewport window on phones; FlatList mounts images as rows approach it. */
export const PROPERTY_LIST_PERFORMANCE = {
  initialNumToRender: 4,
  maxToRenderPerBatch: 4,
  windowSize: 5,
  updateCellsBatchingPeriod: 50,
} as const;

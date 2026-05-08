export function apiError(error) {
  return {
    error: error?.message || "Internal server error",
    details: error?.details || [],
    name: error?.name || "Error"
  };
}

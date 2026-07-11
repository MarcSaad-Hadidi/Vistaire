export type InteractionState = { active: number | null; pinned: boolean };
export type InteractionAction =
  | { type: "focus" | "hover"; index: number }
  | { type: "activate"; index: number }
  | { type: "leave" | "outside" }
  | { type: "key"; key: string; count: number };

export function interactionReducer(state: InteractionState, action: InteractionAction): InteractionState {
  if (action.type === "focus" || action.type === "hover") return state.pinned ? state : { active: action.index, pinned: false };
  if (action.type === "activate") return state.pinned && state.active === action.index ? { active: null, pinned: false } : { active: action.index, pinned: true };
  if (action.type === "outside") return { active: null, pinned: false };
  if (action.type === "leave") return state.pinned ? state : { active: null, pinned: false };
  if (action.type !== "key") return state;
  if (action.key === "Escape") return { active: null, pinned: false };
  if (action.count <= 0) return state;
  const current = state.active ?? -1;
  if (action.key === "Home") return { active: 0, pinned: state.pinned };
  if (action.key === "End") return { active: action.count - 1, pinned: state.pinned };
  if (action.key === "ArrowRight" || action.key === "ArrowDown") return { active: (current + 1 + action.count) % action.count, pinned: state.pinned };
  if (action.key === "ArrowLeft" || action.key === "ArrowUp") return { active: (current - 1 + action.count) % action.count, pinned: state.pinned };
  if ((action.key === "Enter" || action.key === " ") && state.active !== null) return { active: state.active, pinned: !state.pinned };
  return state;
}

export function motionDuration(reduced: boolean, requested = 280) { return reduced ? 0 : Math.min(420, Math.max(180, requested)); }
